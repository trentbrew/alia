var aliases = {}

chrome.storage.sync.get(null, obj => {
  for (o in obj) aliases[o] = obj[o]
})

var re = /[\d\s\+\-=\(\)\*]+/g
var link = /((([A-Za-z]{3,9}:(?:\/\/)?)(?:[\-;:&=\+\$,\w]+@)?[A-Za-z0-9\.\-]+|(?:www\.|[\-;:&=\+\$,\w]+@)[A-Za-z0-9\.\-]+)((?:\/[\+~%\/\.\w\-_]*)?\??(?:[\-\+=&;%@\.\w_]*)#?(?:[\.\!\/\\\w]*))?)/
var search_url = /https:\/\/www\.google\.com\/search\?q=(\w+)&/

// on input change

chrome.omnibox.onInputChanged.addListener((text, suggest) => {
    var suggestions = []
    for (key in aliases) {
      if (key.startsWith(text) || text == "") {
        var desc = `<match>${text}: </match><dim>${key} → </dim><url>${aliases[key]}</url>`
        suggestions.push({content: aliases[key], description: desc});
      }
    }
    if (text.match(re)) {
      var result = eval(text).toString()
      chrome.omnibox.setDefaultSuggestion({description: `<match>= </match><url>${result}</url>`})
    }
    else if (suggestions.length > 0) {
      var first = suggestions.splice(0, 1)[0]
      chrome.omnibox.setDefaultSuggestion({description: first['description']})
    }
    else {
      chrome.omnibox.setDefaultSuggestion({description: `<match>${text}: </match><dim> - Google Search</dim>`})
    }
    suggest(suggestions)
})

// accept omnibox input

chrome.omnibox.onInputEntered.addListener(text => {
    if (text in aliases) {
      chrome.tabs.update({ url: aliases[text] })
    }
    else if (text.match(link)) {
      chrome.tabs.update({ url: text } )
    }
    else if (text.match(re)) {
      var result = eval(text).toString();
      chrome.tabs.update({url: `https://google.com/search?q=${result}`})
    }
    else {
      chrome.tabs.update({url: `https://google.com/search?q=${text}`})
    }
})

// Starting input

chrome.omnibox.onInputStarted.addListener(() => {
  chrome.storage.sync.get(null, obj => {
    for (o in obj) aliases[o] = obj[o]
  })
})
