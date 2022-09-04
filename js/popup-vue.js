new Vue({
  el: "#popup",
  data: () => {
    return {

      alias: {
        name: '',
        url: '',
        status: '',
        placeholder: {
          name: 'gh',
          url: 'https://github.com',
        }
      },
      aliases: {},

    }
  },
  mounted: () => this.mount(),
  methods: {

    mount() {
      console.log('mounted!')
      this.$refs.alias.focus()
      this.getAliases()
      this.storageListener()
    },

    // update alias list

    getAliases() {
      chrome.storage.sync.get(null, aliases => {
        for (alias in aliases) {
          this.aliases.push({ name: alias, url: aliases[alias] })
        }
      })
    },

    // set a new alias and save to storage

    setAlias(alias, url) {
      this.aliases[alias] = url
      chrome.storage.sync.set(this.aliases)
    },

    // remove an alias

    removeAlias(alias) {
      chrome.storage.sync.remove(alias)
      this.getAliases()
    },

    // submit a new alias

    submit() {
      const alias = this.alias.name.replace(/[^\w]/g, '')
      const url = this.alias.url
      if (!alias) {
        this.alias.status = 'error'
        this.alias.placeholder.name = 'Please enter an alias name'
        return
      }
      if (!url) {
        this.alias.status = 'error'
        this.alias.placeholder.url = 'Please enter a URL'
        return
      }
      this.setAlias(alias, url)
      window.close()
      return false
    },
  },

  // listen for changes to local storage

  storageListener() {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      for (key in changes) {
        let storageChange = changes[key]
        if (storageChange.newValue != null) {
          this.aliases.push(key, storageChange.newValue)
        }
      }
    })
  },
})
