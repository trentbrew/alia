new Vue({
  el: "#popup",
  data: () => {
    return {
      alias: {
        name: '',
        url: '',
        status: '',
        placeholder: {
          name: 'alias',
          url: 'url',
        }
      },
      aliases: [],
    }
  },
  mounted: function() {
    // this.$refs.alias.focus()
    this.getAliases()
    chrome.storage.onChanged.addListener((changes, namespace) => {
      for (key in changes) {
        let storageChange = changes[key]
        if (storageChange.newValue != null) {
          this.aliases.push(key, storageChange.newValue)
        }
      }
    })
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
      if (!alias || !url) {
        alert('Please enter an alias and URL')
      }
      this.setAlias(alias, url)
      window.close()
    },
  },
})
