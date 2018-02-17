var userName = 'qip';

function getRandomQiitaItemInStock() {
  var response = UrlFetchApp.fetch('https://qiita.com/api/v2/users/' + userName + '/stocks');
  var items = JSON.parse(response.getContentText());
  
  if(items.length <= 0){
    return null;
  }
  
  var randomItem = items[Math.floor(Math.random() * items.length)];  
  
  return randomItem['url'];
}

function addQiitaItemToStock(itemUrl){
  var regexped = /https:\/\/qiita.com\/.+\/([^#?]*)/.exec(itemUrl);
  if(regexped == null){
    Logger.log('itemUrl is wrong: ' + itemUrl);
    return;
  }

  var itemId = regexped[1];

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
