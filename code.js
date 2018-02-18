var scriptProperties = PropertiesService.getScriptProperties();

var qiita = {
  'apiUrl'        : 'https://qiita.com/api/v2',
  'apiToken'      : scriptProperties.getProperty('QIITA_API_ACCESS_TOKEN'),
  'userId'        : scriptProperties.getProperty('QIITA_USER_ID'),
  'popularBorder' : 10
};

var slack = {
  'outgoingToken' : scriptProperties.getProperty('SLACK_OUTGOING_TOKEN'),
  'incomingUrl'   : scriptProperties.getProperty('SLACK_INCOMING_URL')
}

function main(){
  if(isHoliday()){
    return;
  }

  var stockItem = getRandomQiitaItemInStock();
  if(stockItem){
    postToSlack(stockItem);
  }

  var tagItem = getRandomQiitaItemInTag();
  if(tagItem){
    postToSlack(tagItem);
  }
}

function doPost(e){
  //Slack以外からのリクエストははじく
  if(e['parameter']['token'] != slack['outgoingToken']){
    return;
  }

  var requestText = e['parameter']['text'];
  var regexped = /\<([^\>]+)/.exec(requestText);
  if(regexped == null){
    return;
  }
  var qiitaUrl = regexped[1];
  var qiitaItemId = getQiitaItemId(qiitaUrl);
  if(qiitaItemId == null){
    return;
  }

  addQiitaItemToStock(qiitaItemId);
  addQiitaItemToLike(qiitaItemId);
}

function getQiitaItemId(url){
  var regexped = /https:\/\/qiita.com\/.+\/([^#?]*)/.exec(url);
  return regexped && regexped[1];
}

function getRandomQiitaItemInTag(){
  var tags = execQiitaApiForGet('users', qiita['userId'], 'following_tags');
  var randomTag = getRandomElement(tags);
  if(randomTag == null){
    return;
  }

  var items = execQiitaApiForGet('tags', randomTag['id'], 'items');
  if(items.length <= 0){
    return;
  }

  var isPopularItem = function(item, index, array){
    return item['likes_count'] >= qiita['popularBorder'];
  };
  items = items.filter(isPopularItem);
  var randomItem = getRandomElement(items);

  return randomItem && randomItem['url'];
}

function getRandomQiitaItemInStock() {
  var items = execQiitaApiForGet('users', qiita['userId'], 'stocks');
  var randomItem = getRandomElement(items);
  
  return randomItem && randomItem['url'];
}

function isStocked(itemId){
  return execQiitaApiForCheck('items', itemId, 'stock');
}

function addQiitaItemToStock(itemId){
  if(isStocked(itemId)){
    return;
  }

  execQiitaApiForPut('items', itemId, 'stock');
}

function isLiked(itemId){
  return execQiitaApiForCheck('items', itemId, 'like');
}

function addQiitaItemToLike(itemId){
  if(isLiked(itemId)){
    return;
  }

  execQiitaApiForPut('items', itemId, 'like');
}

function execQiitaApiForGet(targetGroup, targetId, targetType){
  var urlElements = [qiita['apiUrl'], targetGroup, targetId, targetType]
  var response = UrlFetchApp.fetch(urlElements.join('/'));
  return JSON.parse(response.getContentText());
}

function execQiitaApiForCheck(targetGroup, targetId, targetType){
  var urlElements = [qiita['apiUrl'], targetGroup, targetId, targetType];
  var url = urlElements.join('/');

  var options = {
    'method' : 'get',
    'headers': {'Authorization': 'Bearer ' + qiita['apiToken']}
  };

  try{
    UrlFetchApp.fetch(url, options);
    return true;
  }catch(e){
    return false;
  }
}

function execQiitaApiForPut(targetGroup, targetId, targetType){
  var urlElements = [qiita['apiUrl'], targetGroup, targetId, targetType];
  var url = urlElements.join('/');

  var options = {
    'method' : 'put',
    'headers': {'Authorization': 'Bearer ' + qiita['apiToken']}
  };

  UrlFetchApp.fetch(url, options);
}

function postToSlack(message){
  var options = {
    'method'     : 'post',
    'contentType': 'application/json',
    'payload'    : JSON.stringify({'text':message, 'unfurl_links': true})
  };

  UrlFetchApp.fetch(slack['incomingUrl'], options);
}

function isHoliday(){
  var today = new Date();

  //土日か判定
  var weekInt = today.getDay();
  if(weekInt <= 0 || 6 <= weekInt){
    return true;
  }

  //祝日か判定
  var calendarId = "ja.japanese#holiday@group.v.calendar.google.com";
  var calendar = CalendarApp.getCalendarById(calendarId);
  var todayEvents = calendar.getEventsForDay(today);
  if(todayEvents.length > 0){
    return true;
  }

  return false;
}

function getRandomElement(array){
  if(array.length <= 0){
    return;
  }

  return array[Math.floor(Math.random() * array.length)];
}