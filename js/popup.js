import aliasStorage from './storage.js';

// Get the chrome API
const { chrome } = window;

let aliases = {};

// Initialize aliases from IndexedDB
document.addEventListener('DOMContentLoaded', async () => {
  aliases = await aliasStorage.getAll() || {};
});

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

	$('#go').keyup(e => {
		$('#aliases').empty()
		var text = $('#go').val()
		getFiltered(text)
	})
})

async function set(alias, url) {
  try {
    await aliasStorage.set(alias, url);
    aliases[alias] = url;
    $("#alias").val("");
    $("#url").val("");
    alert(`Successfully created alias '${alias}'`);
    window.close();
  } catch (error) {
    console.error('Error saving alias:', error);
    alert('Failed to save alias. Please try again.');
  }
}

// No need for a change listener with IndexedDB as we update the UI directly

async function get() {
  try {
    const allAliases = await aliasStorage.getAll();
    $("#aliases").empty();
    for (const alias in allAliases) {
      insert(alias, allAliases[alias]);
    }
  } catch (error) {
    console.error('Error getting aliases:', error);
  }
}

async function getFiltered(text) {
  try {
    const allAliases = await aliasStorage.getAll();
    $("#aliases").empty();
    for (const alias in allAliases) {
      if (alias.toLowerCase().includes(text.toLowerCase())) {
        insert(alias, allAliases[alias]);
      }
    }
  } catch (error) {
    console.error('Error filtering aliases:', error);
  }
}

async function clear() {
  try {
    await aliasStorage.clear();
    aliases = {};
    $("#aliases").empty();
    console.log('Storage cleared');
  } catch (error) {
    console.error('Error clearing storage:', error);
  }
}

async function remove(alias) {
  try {
    await aliasStorage.remove(alias);
    delete aliases[alias];
    $(`#${alias}`).parent().remove();
    alert(`Alias '${alias}' has been removed`);
  } catch (error) {
    console.error('Error removing alias:', error);
    alert('Failed to remove alias. Please try again.');
  }
}

function insert(alias, url) {
	$("#aliases").append(`
		<div class="flex gap-6 mb-3 w-full items-center">
			<a class="badge badge-error rounded-full badge-lg px-1 hover:opacity-75 cursor-pointer !duration-0" id="${alias}">
				<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="inline-block w-4 h-4 stroke-current"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
			</a>
			<div class="badge badge-secondary rounded-full">${alias}</div><div class="max-w-full align-left opacity-75 truncate">${url}</div>
		</div>
	`)
	$(`#${alias}`).click(e => {
		remove(alias)
		return false
	})
}

function go(text) {
  try {
    let url;
    
    if (text in aliases) {
      url = aliases[text];
    } else if (text.match(/^https?:\/\//) || text.match(/^[a-zA-Z0-9-_.]+\.[a-zA-Z]{2,5}(\/.*)?$/)) {
      // Add https:// if not present
      url = text.match(/^https?:\/\//) ? text : `https://${text}`;
    } else {
      url = `https://google.com/search?q=${encodeURIComponent(text)}`;
    }
    
    chrome.tabs.update({ url });
    window.close();
  } catch (error) {
    console.error('Error navigating to URL:', error);
    alert('Failed to navigate. Please try again.');
  }
}