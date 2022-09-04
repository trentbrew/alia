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
  mounted: () => {
    console.log('mounted!')
    this.$refs.alias.focus()
    this.getAliases()
    this.storageListener()
  },
  methods: {
    getAliases() {
      chrome.storage.sync.get(null, aliases => {
        for (alias in aliases) {
          this.aliases.push({ name: alias, url: aliases[alias] })
        }
      })
    },
    setAlias(alias, url) {
      this.aliases[alias] = url
      chrome.storage.sync.set(this.aliases)
    },
    removeAlias(alias) {
      chrome.storage.sync.remove(alias)
      this.getAliases()
    },
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
