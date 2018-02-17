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
