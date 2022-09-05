var aliases = {}

chrome.storage.sync.get(null, obj => {
  for (o in obj) aliases[o] = obj[o]
})

$(() => {
	get()

  $("#go").focus()

	$("#new").submit(e => {
		var alias = $("#alias").val().replace(/[^\w]/g, '')
		var url = $("#url").val()
		if (alias == "" || url == "") {
			e.preventDefault()
			alert("You must enter an alias and url...")
			return
		}
		set(alias, url)
		return false
	})

	$('#go-form').submit(e => {
		var text = $('#go').val()
		if (text == '') {
			e.preventDefault()
			alert("You didn't enter anything :/")
			return
		}
		go(text)
	})
})

function set(alias, url) {
	var obj = {}
	obj[alias] = url
	chrome.storage.sync.set(obj, () => {
  	$("#alias").val("")
		$("#url").val("")
	})
	alert(`Successfully created alias '${alias}'`)
  window.close()
}

chrome.storage.onChanged.addListener((changes, namespace) => {
    for (key in changes) {
      var storageChange = changes[key]
      if (storageChange.newValue != null) {
      	insert(key, storageChange.newValue)
      }
    }
})

function get() {
	chrome.storage.sync.get(null, obj => {
		for (o in obj) insert(o, obj[o])
	})
}

function clear() {
	chrome.storage.sync.clear(() => {
		console.log('cleared!')
	})
	$("#aliases").html("")
}

function remove(alias) {
	chrome.storage.sync.remove(alias, () => {
		$(`#${alias}`).parent().remove()
		alert(`Alias '${alias}' has been removed`)
	})
}

function insert(alias, url) {
	$("#aliases").append(`
		<div class="flex gap-6 mb-3 w-full">
			<a class="badge badge-error rounded-full badge-lg px-1 hover:opacity-75 cursor-pointer duration-0" id="${alias}">
				<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="inline-block w-4 h-4 stroke-current"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
			</a>
			<div class="badge badge-secondary rounded-full">${alias}</div><div class="badge rounded-full max-w-full align-left text-ellipsis truncate opacity-75 bg-transparent justify-start">${url}</div>
		</div>
	`)
	$(`#${alias}`).click(e => {
		remove(alias)
		return false
	})
}

function go(text) {
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
	window.close()
}