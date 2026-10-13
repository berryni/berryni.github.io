Personal website: plain HTML, CSS and JavaScript served as-is by GitHub Pages.
There is no build step (`.nojekyll` turns off GitHub's Jekyll processing).

## Preview locally

```
python3 -m http.server 8000
```

then open http://localhost:8000.

## Where things live

- `index.html`: the homepage. Publications, talks, research and footnotes are
  plain HTML. The revision-history slider text is the JSON block at the top
  of the page; the current revision is also written out in the page itself,
  so update both when it changes. Bump the "last revised" date in the footer.
- `assets/css/style.css`: all styles. Colors and fonts are variables at the top.
- `assets/js/report.js`: typing, revision history, the reading-depth chart and
  the 8-bit author. Either animation can be switched off at the top of the file.
- `NickBerryCV.pdf`: the CV linked as "Appendix A". `/cv` redirects to it.

## License

The site's code (HTML structure, CSS and JavaScript) is MIT licensed; see
`LICENSE`. The written content, CV and photo are © Nicholas S. Berry, all
rights reserved.
