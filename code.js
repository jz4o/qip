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

function postToSlack(message){
  var url = PropertiesService.getScriptProperties().getProperty('SLACK_INCOMING_URL');
  var options = {
    'method'     : 'post',
    'contentType': 'application/json',
    'payload'    : JSON.stringify({'text':message, 'unfurl_links': true})
  };

  UrlFetchApp.fetch(url, options);
}
