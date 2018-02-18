var userName = 'qip';

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
  var accessToken  = PropertiesService.getScriptProperties().getProperty('SLACK_OUTGOIN_TOKEN');
  //Slack以外からのリクエストははじく
  if(e['parameter']['token'] != accessToken){
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
  var tags = execQiitaApiForGet('users', userName, 'following_tags');
  var randomTag = getRandomElement(tags);
  if(randomTag == null){
    return;
  }

  var items = execQiitaApiForGet('tags', randomTag['id'], 'items');
  if(items.length <= 0){
    return;
  }

  var isPopularItem = function(item, index, array){ return item['likes_count'] >= 10;};
  items = items.filter(isPopularItem);
  var randomItem = getRandomElement(items);

  return randomItem && randomItem['url'];
}

function getRandomQiitaItemInStock() {
  var items = execQiitaApiForGet('users', userName, 'stocks');
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
  var urlElements = ['https://qiita.com/api/v2', targetGroup, targetId, targetType]
  var response = UrlFetchApp.fetch(urlElements.join('/'));
  return JSON.parse(response.getContentText());
}

function execQiitaApiForCheck(targetGroup, targetId, targetType){
  var urlElements = ['https://qiita.com/api/v2', targetGroup, targetId, targetType];
  var url = urlElements.join('/');

  var accessToken = PropertiesService.getScriptProperties().getProperty('QIITA_API_ACCESS_TOKEN');
  var options = {
    'method' : 'get',
    'headers': {'Authorization': 'Bearer ' + accessToken}
  };

  try{
    UrlFetchApp.fetch(url, options);
    return true;
  }catch(e){
    return false;
  }
}

function execQiitaApiForPut(targetGroup, targetId, targetType){
  var urlElements = ['https://qiita.com/api/v2', targetGroup, targetId, targetType];
  var url = urlElements.join('/');

  var accessToken = PropertiesService.getScriptProperties().getProperty('QIITA_API_ACCESS_TOKEN');
  var options = {
    'method' : 'put',
    'headers': {'Authorization': 'Bearer ' + accessToken}
  };

  UrlFetchApp.fetch(url, options);
}

function postToSlack(message){
  var url = PropertiesService.getScriptProperties().getProperty('SLACK_INCOMING_URL');
  var options = {
    'method'     : 'post',
    'contentType': 'application/json',
    'payload'    : JSON.stringify({'text':message, 'unfurl_links': true})
  };

  UrlFetchApp.fetch(url, options);
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