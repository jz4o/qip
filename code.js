var userName = 'qip';

function main(){
  var stockItem = getRandomQiitaItemInStock();
  if(stockItem){
    postToSlack(stockItem);
  }

  var tagItem = getRandomQiitaItemInTag();
  if(tagItem){
    postToSlack(tagItem);
  }
}

function getRandomQiitaItemInTag(){
  var response = UrlFetchApp.fetch('https://qiita.com/api/v2/users/' + userName + '/following_tags');
  var tags = JSON.parse(response.getContentText());
  if(tags.length <= 0){
    return;
  }

  var randomTag = tags[Math.floor(Math.random() * tags.length)];

  response = UrlFetchApp.fetch('https://qiita.com/api/v2/tags/' + randomTag['id'] + '/items');
  var items = JSON.parse(response.getContentText());
  if(items.length <= 0){
    return;
  }

  var isPopularItem = function(item, index, array){ return item['likes_count'] >= 10;};
  items = items.filter(isPopularItem);
  if(items.length <= 0){
    return;
  }

  var randomItem = items[Math.floor(Math.random() * items.length)];  

  return randomItem['url'];
}

function getRandomQiitaItemInStock() {
  var response = UrlFetchApp.fetch('https://qiita.com/api/v2/users/' + userName + '/stocks');
  var items = JSON.parse(response.getContentText());
  
  if(items.length <= 0){
    return null;
  }
  
  var randomItem = items[Math.floor(Math.random() * items.length)];  
  
  return randomItem['url'];
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

function postToSlack(message){
  var url = PropertiesService.getScriptProperties().getProperty('SLACK_INCOMING_URL');
  var options = {
    'method'     : 'post',
    'contentType': 'application/json',
    'payload'    : JSON.stringify({'text':message, 'unfurl_links': true})
  };

  UrlFetchApp.fetch(url, options);
}
