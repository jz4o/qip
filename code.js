// スクリプトに設定されたプロパティ一覧
var scriptProperties = PropertiesService.getScriptProperties();

// Qiita関連の各種設定値
var qiita = {
  'apiUrl'            : 'https://qiita.com/api/v2',
  'apiToken'          : scriptProperties.getProperty('QIITA_API_ACCESS_TOKEN'),
  'apiRequestPerPage' : 100,
  'apiRequestMaxPage' : 100,
  'userId'            : scriptProperties.getProperty('QIITA_USER_ID'),
  'popularBorder'     : 10
};

// Slack関連の各種設定値
var slack = {
  'outgoingToken' : scriptProperties.getProperty('SLACK_OUTGOING_TOKEN'),
  'incomingUrl'   : scriptProperties.getProperty('SLACK_INCOMING_URL')
};

/**
 * Qiitaの記事から以下の記事を1件ずつ取得し、Slackへ投稿します.
 *
 *  - ストックした記事
 *  - フォローしたタグがつけられた記事
 *
 * プロジェクトトリガーを設定し、毎日実行します
 */
function main(){
  // 平日以外の場合、処理を中止
  if(isHoliday()){
    return;
  }

  // Qiitaでストックされた記事からランダムにSlackへ投稿
  var stockItem = getRandomQiitaItemInStock();
  if(stockItem){
    postToSlack(stockItem);
  }

  // Qiitaでフォロー中のタグがつけられた記事からランダムにSlackへ投稿
  var tagItem = getRandomQiitaItemInTag();
  if(tagItem){
    postToSlack(tagItem);
  }
}

/**
 * Slackに投稿されたQiita記事をストック及び「いいね」します.
 *
 * OutgoingWebhooksを経由してリクエストされる想定
 */
function doPost(e){
  //Slack以外からのリクエストははじく
  if(e['parameter']['token'] != slack['outgoingToken']){
    return;
  }

  // 投稿内容からQiita記事のIDを取得
  // ※取得に失敗した場合は処理を中止
  var requestText = e['parameter']['text'];
  var regexped = /\<([^\>]+)/.exec(requestText);
  if(regexped == null){
    return;
  }
  var qiitaUrl = regexped[1];

  // Qiita記事URLがポストされた場合
  if(qiitaItemId = getQiitaItemId(qiitaUrl)){
    // ストック及びいいねの登録
    addQiitaItemToStock(qiitaItemId);
    addQiitaItemToLike(qiitaItemId);
  }

  // QiitaタグURLがポストされた場合
  if(qiitaTagId = getQiitaTagId(qiitaUrl)) {
    // フォロー登録
    addQiitaTagToFollow(qiitaTagId);
  }
}

/**
 * QiitaのURLから記事のIDを取得し、返します.
 * ※取得に失敗した場合はNullを返します
 *
 * @param string url Qiita記事URL
 *
 * @return string / null Qiita記事ID
 */
function getQiitaItemId(url){
  var regexped = /https:\/\/qiita.com\/.+\/items\/([^#?]*)/.exec(url);
  return regexped && regexped[1];
}

/**
 * QiitaのURLからタグのIDを取得し、返します.
 * ※取得に失敗した場合はNullを返します
 *
 * @param string url QiitaタグURL
 *
 * @return string / null QiitaタグID
 */
function getQiitaTagId(url) {
  var regexped = /https:\/\/qiita.com\/tags\/(.*)/.exec(url);
  return regexped && regexped[1];
}

/**
 * Qiitaにてフォロー中のタグがつけられた記事からランダムに1件を取得し、記事URLを返します.
 * ※ある程度良い内容の記事を取得するため、「いいね」数によって絞込みを行います
 * ※取得に失敗した場合はNullを返します
 *
 * @return string / null 記事URL
 */
function getRandomQiitaItemInTag(){
  // フォロー中のタグからランダムに1件取得
  // 取得に失敗した場合は処理を中止
  var tags = execQiitaApiForGet('users', qiita['userId'], 'following_tags');
  var randomTag = getRandomElement(tags);
  if(randomTag == null){
    return;
  }

  // 上記で取得したタグのついた記事を取得
  // 取得に失敗した場合は処理を中止
  var items = execQiitaApiForGet('tags', randomTag['id'], 'items');
  if(items.length <= 0){
    return;
  }

  // 一定数以上の「いいね」がついた記事からランダムに1件取得
  var isPopularItem = function(item, index, array){
    return item['likes_count'] >= qiita['popularBorder'];
  };
  items = items.filter(isPopularItem);
  var randomItem = getRandomElement(items);

  // 該当の記事URLを返す
  return randomItem && randomItem['url'];
}

/**
 * Qiitaにてストックした記事からランダムに1件を取得し、記事URLを返します.
 * ※取得に失敗した場合はNullを返します
 *
 * @return string / null 記事URL
 */
function getRandomQiitaItemInStock() {
  // ストックした記事からランダムに1件取得
  var items = execQiitaApiForGet('users', qiita['userId'], 'stocks');
  var randomItem = getRandomElement(items);

  //　該当の記事URLを返す
  return randomItem && randomItem['url'];
}

/**
 * 該当のQiita記事をストック済みか確認し、結果を返します.
 *
 * @param string itemId 記事ID
 *
 * @return boolean ストック済みの場合 `true`
 */
function isStocked(itemId){
  return execQiitaApiForCheck('items', itemId, 'stock');
}

/**
 * 該当のQiita記事をストックします.
 *
 * @param string itemId 記事ID
 */
function addQiitaItemToStock(itemId){
  // すでにストック済みの場合は処理を中止
  if(isStocked(itemId)){
    return;
  }

  // ストック登録
  execQiitaApiForPut('items', itemId, 'stock');
}

/**
 * 該当のQiita記事をいいね済みか確認し、結果を返します.
 *
 * @param string itemId 記事ID
 *
 * @return boolean いいね済みの場合 `true`
 */
function isLiked(itemId){
  return execQiitaApiForCheck('items', itemId, 'like');
}

/**
 * 該当のQiita記事をいいねします.
 *
 * @param string itemId 記事ID
 */
function addQiitaItemToLike(itemId){
  // すでにいいね済みの場合は処理を中止
  if(isLiked(itemId)){
    return;
  }

  // いいね登録
  execQiitaApiForPut('items', itemId, 'like');
}

/**
 * 該当のQiitaタグをフォロー済みか確認し、結果を返します.
 *
 * @param string tagId タグID
 *
 * @return boolean フォロー済みの場合 `true`
 */
function isFollowed(tagId) {
  return execQiitaApiForCheck('tags', tagId, 'following');
}

/**
 * 該当のQiitaタグをフォローします.
 *
 * @param string tagId タグID
 */
function addQiitaTagToFollow(tagId){
  if(isFollowed(tagId)){
    return;
  }

  // フォロー
  execQiitaApiForPut('tags', tagId, 'following');
}

/**
 * QiitaAPIを使用し、データを取得し、返します.
 *
 * @param string targetGroup データ所有元の所属するグループ
 * @param string targetId    データ所有元のID
 * @param string targetType  取得対象のデータ種別
 * @param int    perPage     各リクエストごとの最大取得データ数
 * @param int    maxPage     リクエストの最大発行回数
 *
 * @return array 取得結果(連想配列)の配列
 */
function execQiitaApiForGet(targetGroup, targetId, targetType, perPage, maxPage){
  // パラメータを初期化
  perPage = perPage || qiita['apiRequestPerPage'];
  maxPage = maxPage || qiita['apiRequestMaxPage'];

  // リクエスト対象のURL
  var url = [qiita['apiUrl'], targetGroup, targetId, targetType].join('/');

  // リクエスト設定
  var options = {
    'method' : 'get',
    'headers': {'Authorization': 'Bearer ' + qiita['apiToken']}
  };

  // リクエストを発行し、該当の要素数を取得
  var totalCount = UrlFetchApp.fetch(url, options).getHeaders()['total-count'];

  //　該当の要素数からページ数を取得
  var pageCount = Math.ceil(totalCount / perPage);

  // 取得対象となるページ数の最大値を取得
  maxPage = Math.min(maxPage, pageCount);

  // 取得対象の各ページを対象にリクエストを発行
  var result = [];
  for(var targetPage = 1; targetPage <= maxPage; targetPage++){
    // リクエスト対象のURL
    var targetPageUrl = url + '?' + 'per_page=' + perPage + '&' + 'page=' + targetPage;

    // リクエスト発行
    var response = UrlFetchApp.fetch(targetPageUrl, options);
    var responseJson = JSON.parse(response.getContentText());

    // 返却用の配列にレスポンスを追加
    Array.prototype.push.apply(result, responseJson);
  }

  // レスポンス結果を呼び出し元に返す
  return result;
}

/**
 * QiitaAPIを使用し、該当のデータの登録状況を取得し、返します.
 *
 * @param string targetGroup データ登録元の所属するグループ
 * @param string targetId    データ登録元のID
 * @param string targetType  確認対象のデータ種別
 *
 * @return boolean 登録済みの場合 `true`
 */
function execQiitaApiForCheck(targetGroup, targetId, targetType){
  // リクエスト対象のURL
  var url = [qiita['apiUrl'], targetGroup, targetId, targetType].join('/');

  // リクエスト設定
  var options = {
    'method' : 'get',
    'headers': {'Authorization': 'Bearer ' + qiita['apiToken']}
  };

  try{
    // リクエスト発行
    UrlFetchApp.fetch(url, options);
    return true;
  }catch(e){
    // 登録済みでない場合は例外発生
    return false;
  }
}

/**
 * QiitaAPIを使用し、該当のデータを登録します.
 *
 * @param string targetGroup データ登録元の所属するグループ
 * @param string targetId    データ登録元のID
 * @param string targetType  登録対象のデータ種別
 */
function execQiitaApiForPut(targetGroup, targetId, targetType){
  // リクエスト対象のURL
  var url = [qiita['apiUrl'], targetGroup, targetId, targetType].join('/');

  // リクエスト設定
  var options = {
    'method' : 'put',
    'headers': {'Authorization': 'Bearer ' + qiita['apiToken']}
  };

  // リクエスト発行
  UrlFetchApp.fetch(url, options);
}

/**
 * Slackへメッセージを投稿します.
 *
 * SlackのIncomingWebhooksを経由してリクエストする想定
 *
 * @param string message 投稿内容
 */
function postToSlack(message){
  // リクエスト設定
  var options = {
    'method'     : 'post',
    'contentType': 'application/json',
    'payload'    : JSON.stringify({'text':message, 'unfurl_links': true})
  };

  // リクエスト発行
  UrlFetchApp.fetch(slack['incomingUrl'], options);
}

/**
 * 当日の休日祝日判定を行い、結果を返します.
 *
 * @return boolean 当日が休日もしくは祝日の場合 `true`
 */
function isHoliday(){
  var today = new Date();

  //土日判定
  var weekInt = today.getDay();
  if(weekInt <= 0 || 6 <= weekInt){
    return true;
  }

  //祝日判定
  var calendarId = "ja.japanese#holiday@group.v.calendar.google.com";
  var calendar = CalendarApp.getCalendarById(calendarId);
  var todayEvents = calendar.getEventsForDay(today);
  if(todayEvents.length > 0){
    return true;
  }

  return false;
}

/**
 * 配列からランダムに要素を取得し、返します.
 * ※配列が空の場合Nullを返します
 *
 * @param array 配列
 *
 * @return object / null 要素
 */
function getRandomElement(array){
  if(array.length <= 0){
    return;
  }

  return array[Math.floor(Math.random() * array.length)];
}
