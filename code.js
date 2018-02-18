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

  addQiitaItemToStock(qiitaUrl);
  addQiitaItemToLike(qiitaUrl);
}

function getRandomQiitaItemInTag(){
  var response = UrlFetchApp.fetch('https://qiita.com/api/v2/users/' + userName + '/following_tags');
  var tags = JSON.parse(response.getContentText());
  var randomTag = getRandomElement(tags);
  if(randomTag == null){
    return;
  }

  response = UrlFetchApp.fetch('https://qiita.com/api/v2/tags/' + randomTag['id'] + '/items');
  var items = JSON.parse(response.getContentText());
  if(items.length <= 0){
    return;
  }

  var isPopularItem = function(item, index, array){ return item['likes_count'] >= 10;};
  items = items.filter(isPopularItem);
  var randomItem = getRandomElement(items);

  return randomItem && randomItem['url'];
}

function getRandomQiitaItemInStock() {
  var response = UrlFetchApp.fetch('https://qiita.com/api/v2/users/' + userName + '/stocks');
  var items = JSON.parse(response.getContentText());
  var randomItem = getRandomElement(items);
  
  return randomItem && randomItem['url'];
}

function isStocked(itemId){
  var url = 'https://qiita.com/api/v2/items/' + itemId + '/stock';

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

function addQiitaItemToStock(itemUrl){
  var regexped = /https:\/\/qiita.com\/.+\/([^#?]*)/.exec(itemUrl);
  if(regexped == null){
    Logger.log('itemUrl is wrong: ' + itemUrl);
    return;
  }

  var itemId = regexped[1];

  if(isStocked(itemId)){
    return;
  }

  var url = 'https://qiita.com/api/v2/items/' + itemId + '/stock';

  var accessToken = PropertiesService.getScriptProperties().getProperty('QIITA_API_ACCESS_TOKEN');
  var options = {
    'method' : 'put',
    'headers': {'Authorization': 'Bearer ' + accessToken}
  };

  UrlFetchApp.fetch(url, options);
}

function isLiked(itemId){
  var url = 'https://qiita.com/api/v2/items/' + itemId + '/like';

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

function addQiitaItemToLike(itemUrl){
  var regexped = /https:\/\/qiita.com\/.+\/([^#?]*)/.exec(itemUrl);
  if(regexped == null){
    Logger.log('itemUrl is wrong: ' + itemUrl);
    return;
  }

  var itemId = regexped[1];

  if(isLiked(itemId)){
    return;
  }

  var url = 'https://qiita.com/api/v2/items/' + itemId + '/like';

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