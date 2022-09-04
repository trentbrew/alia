// $(() => {
// 	get()

// 	$("#alias").focus()

// 	$("#new-alias").submit(e => {
// 		var alias = $("#alias").val().replace(/[^\w]/g, '')
// 		var url = $("#url").val()
// 		if (alias == "" || url == "") {
// 			e.preventDefault()
// 			alert("You must enter an alias and url...")
// 			return;
// 		}
// 		set(alias, url)
// 		window.close()
// 		return false
// 	})
// })

// function set(alias, url) {
// 	var obj = {}
// 	obj[alias] = url
// 	chrome.storage.sync.set(obj, () => {
//   	$("#alias").val("")
// 		$("#url").val("")
// 	})
// }

// chrome.storage.onChanged.addListener((changes, namespace) => {
//     for (key in changes) {
//       var storageChange = changes[key]
//       if (storageChange.newValue != null) {
//       	insert(key, storageChange.newValue)
//       }
//     }
// })

// function get() {
// 	chrome.storage.sync.get(null, obj => {
// 		for (o in obj) insert(o, obj[o])
// 	})
// }

// function remove(alias) {
// 	chrome.storage.sync.remove(alias, () => {
// 		$(`#${alias}`).parent().remove()
// 	})
// }

// function insert(alias, url) {
// 	$("#aliases").append(`
// 		<li class="flex gap-3 mb-4 w-full justify-start">
// 			<a role="button" class="badge badge-error badge-lg px-1 hover:opacity-75 cursor-pointer !duration-0" id="${alias}"><svg fill="none" viewBox="0 0 24 24" class="inline-block w-4 h-4 stroke-current"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></a>
// 			<div class="badge badge-lg badge-secondary">${alias}</div><div class="badge badge-lg w-[500px] truncate text-ellipsis align-left justify-start opacity-75">${url}</div>
// 		</li>
// 	`)
// 	$(`#${alias}`).click(e => {
// 		remove(alias)
// 		return false
// 	})
// }
