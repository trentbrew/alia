![alia2](https://user-images.githubusercontent.com/32501733/194616396-6c57f4be-dade-4179-89f0-ce67bc34e3dd.png)

![image](https://user-images.githubusercontent.com/32501733/188302547-3712ef4e-b951-43af-9074-03de3af72103.png)

Based on https://github.com/sean-smith/chromeshortcuts

## Launcher (tab-strip-less windows)

`launcher.html` is a full-window version of the bar for Chromium `--app` windows,
which have no omnibox:

```sh
chromium --app=chrome-extension://djdjbcnmonfejmcnjdjheglcipdennfi/launcher.html
chromium --app='chrome-extension://djdjbcnmonfejmcnjdjheglcipdennfi/launcher.html?q=gh'   # resolve immediately
```

The manifest pins a `key`, so the unpacked extension always gets that id. Load it
with `--load-extension=/path/to/alia` (in `~/.config/chromium-flags.conf`).

- **Input**: alias → `3000` / `3k` (localhost port) → URL or bare domain → math → Google search.
- **Alt+L** opens the bar over any page (change it at `chrome://extensions/shortcuts`).
  The current URL is prefilled, so it doubles as an address bar.
- **`+name [url]`** saves an alias (defaults to the current page), **`-name`** removes one.
- `target=_blank` links from a launcher window move into a popup window (no tab strip)
  instead of landing in a tabbed browser window.
- Theme: `?bg=&fg=&accent=&muted=&surface=&font=` (colors as `%23rrggbb`) are remembered.
