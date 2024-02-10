import { pageInterface } from '../pageInterface';

export const Suwayomi: pageInterface = {
  name: 'Suwayomi',
  domain: 'https://suwayomi-webui-preview.github.io/',
  languages: ['English'],
  type: 'manga',
  isSyncPage(url) {
    return url.split('/')[5] === 'chapter';
  },
  isOverviewPage(url) {
    return url.split('/')[3] === 'manga';
  },
  sync: {
    getTitle(url) {
      return j
        .$('title')
        .text()
        .replace(/(.+): .+ - Suwayomi/g, '$1');
    },
    getIdentifier(url) {
      return utils.urlPart(url, 4);
    },
    getOverviewUrl(url) {
      return url.split('chapter')[0];
    },
    getEpisode(url) {
      const temp = utils.getBaseText(j.$('title')).match(/(ch\.|chapter)\D?(\d+)/i);

      if (!temp) return 1;

      return parseInt(temp[2]);
    },
    getVolume(url) {
      const temp = utils.getBaseText(j.$('title')).match(/(vol\.|volume)\D?(\d+)/i);
      if (temp) {
        return parseInt(temp[2]);
      }
      return 0;
    },
  },
  overview: {
    getTitle(url) {
      return j.$('h1').text();
    },
    getIdentifier(url) {
      return utils.urlPart(url, 4);
    },
    uiSelector(selector) {
      j.$('h4').first().before(j.html(selector));
    },
  },
  init(page) {
    let interval;
    api.storage.addStyle(
      require('!to-string-loader!css-loader!less-loader!./style.less').toString(),
    );
    utils.fullUrlChangeDetect(() => {
      page.reset();
      clearInterval(interval);
      interval = utils.waitUntilTrue(
        () => {
          return j.$('title').length;
        },
        () => {
          page.handlePage();
        },
      );
    });
  },
};
