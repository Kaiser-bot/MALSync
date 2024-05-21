import { ScriptProxy } from '../../utils/scriptProxy';
import { pageInterface } from '../pageInterface';

// Define the variable proxy element:
const proxy = new ScriptProxy('Emby');

let item: any;

async function getApiKey() {
  return api.storage.get('emby_Api_Key');
}

async function setApiKey(key) {
  return api.storage.set('emby_Api_Key', key);
}

async function getBase() {
  return api.storage.get('emby_Base');
}

async function setBase(key) {
  return api.storage.set('emby_Base', key);
}

async function checkApi(page) {
  const videoEl = $('video');
  if (videoEl.length) {
    $('html').addClass('miniMAL-hide');
    const url = videoEl.attr('src');
    con.log(url);
    let itemId = '';
    let apiKey = '';
    let apiBase = '';

    if (url) {
      if (/blob:/i.test(url)) {
        apiBase = await getBase();
        itemId = await returnPlayingItemId();
        apiKey = await getApiKey();
      } else {
        apiBase = url.split('/').splice(0, 4).join('/');
        itemId = utils.urlPart(url, 5);
        apiKey = await getApiKey();
        await setBase(apiBase);
      }
    }

    let reqUrl = `${apiBase}/Items?ids=${itemId}&api_key=${apiKey}`;
    con.log('reqUrl', reqUrl, 'base', apiBase, 'apiKey', apiKey);

    api.request
      .xhr('GET', reqUrl)
      .then(response => {
        const data = JSON.parse(response.responseText);
        item = data.Items[0];
        reqUrl = `${apiBase}/Genres?Ids=${item.SeriesId}&api_key=${apiKey}`;
        con.log(data);
        return api.request.xhr('GET', reqUrl);
      })
      .then(response => {
        const genres: any = JSON.parse(response.responseText);
        con.log('genres', genres);
        for (let i = 0; i < genres.Items.length; i++) {
          const genre = genres.Items[i];
          if (genre.Name === 'Anime') {
            con.info('Anime detected');
            page.url = `${window.location.origin}/#!/itemdetails.html?id=${itemId}`;
            page.handlePage(page.url);
            $('html').removeClass('miniMAL-hide');
            break;
          }
        }
      });
  }
}

async function urlChange(page) {
  $('html').addClass('miniMAL-hide');
  if (window.location.href.indexOf('id=') !== -1) {
    const id = utils.urlParam(window.location.href, 'id');
    let reqUrl = `/Items?ids=${id}`;
    apiCall(reqUrl).then(response => {
      const data = JSON.parse(response.responseText);
      switch (data.Items[0].Type) {
        case 'Season':
          con.log('Season', data);
          item = data.Items[0];
          reqUrl = `/Genres?Ids=${item.SeriesId}`;
          apiCall(reqUrl).then(response2 => {
            const genres: any = JSON.parse(response2.responseText);
            con.log('genres', genres);
            for (let i = 0; i < genres.Items.length; i++) {
              const genre = genres.Items[i];
              if (genre.Name === 'Anime') {
                con.info('Anime detected');
                page.handlePage();
                $('html').removeClass('miniMAL-hide');
                break;
              }
            }
          });
          break;
        case 'Series':
          con.log('Series', data);
          break;
        default:
          con.log('Not recognized', data);
      }
    });
  }
}

async function returnPlayingItemId() {
  return new Promise<void>((resolve, reject) => {
    setTimeout(() => {
      resolve();
    }, 10000);
  }).then(() => {
    return apiCall('/Sessions').then(response => {
      con.error(response);
      const data = JSON.parse(response.responseText);
      con.log(data);
      for (let i = 0; i < data.length; i++) {
        const sess = data[i];
        if (typeof sess.NowPlayingItem !== 'undefined') {
          con.log(sess.NowPlayingItem);
          return sess.NowPlayingItem.Id;
        }
      }
      return '';
    });
  });
}

async function waitForBase() {
  return new Promise((resolve, reject) => {
    utils.waitUntilTrue(
      function () {
        return (
          j.$('*[data-url]').length ||
          (j.$('.view:not(.hide) .cardImageContainer').first().css('background-image') &&
            j.$('.view:not(.hide) .cardImageContainer').first().css('background-image') !== 'none')
        );
      },
      function () {
        let elementUrl = j.$('*[data-url]').first().attr('data-url') || '';

        if (!elementUrl) {
          elementUrl = j
            .$('.view:not(.hide) .cardImageContainer')
            .first()
            .css('background-image')
            .replace('url("', '')
            .replace('")', '');
        }

        const base = elementUrl.split('/').splice(0, 4).join('/');
        con.log('Base Found', base);
        resolve(base);
      },
    );
  });
}

async function prepareApi() {
  const logger = con.m('Emby').m('Athentication');
  logger.info('Start Authentication');
  return getFromApiClient().catch(err => {
    logger.error('ApiClient Failed', err);
    logger.info('Waiting for Base');
    return getFromPage().catch(async () => {
      utils.flashm('Could not Authenticate');
      throw 'Not Authenticated [Emby]';
    });
  });
}

async function getFromApiClient() {
  await utils.wait(2000);
  await checkApiClient();
  return testApi();
}

async function getFromPage() {
  const base = await waitForBase();
  await setBase(base);
  await askForApiKey();
  return testApi();
}

async function testApi() {
  return apiCall('/System/Info', null).then(async response => {
    if (response.status !== 200) {
      con.error('Not Authenticated');
      await setBase('');

      throw 'Not Authenticated [Emby]';
    }
    return true;
  });
}

async function checkApiClient() {
  const apiClient: any = await proxy.getData();
  con.m('apiClient').log(apiClient);
  if (
    apiClient &&
    apiClient._serverInfo &&
    apiClient._serverInfo.RemoteAddress &&
    apiClient._serverInfo.AccessToken
  ) {
    await setBase(`${apiClient._serverInfo.RemoteAddress}/emby`);
    await setApiKey(apiClient._serverInfo.AccessToken);
    return;
  }
  throw 'No ApiClient';
}

async function askForApiKey() {
  return new Promise((resolve, reject) => {
    const msg = utils.flashm(
      `<p>${api.storage.lang('Emby_Authenticate')}</p>
      <p><input id="MS-ApiKey" type="text" placeholder="Please enter the Api Key here" style="width: 100%;"></p>
      <div style="display: flex; justify-content: space-around;">
        <button class="Yes" style="background-color: transparent; border: none; color: rgb(255,64,129);margin-top: 10px; cursor:pointer;">OK</button>
        <button class="Cancel" style="background-color: transparent; border: none; color: rgb(255,64,129);margin-top: 10px; cursor:pointer;">CANCEL</button>
      </div>
      `,
      { position: 'bottom', permanent: true, type: 'getApi' },
    );
    msg.find('.Yes').click(function (evt) {
      const api = j.$('#MS-ApiKey').val();
      con.info('api', api);
      setApiKey(api);
      j.$(evt.target).parentsUntil('.flash').remove();
      resolve(true);
    });
    msg.find('.Cancel').click(function (evt) {
      j.$(evt.target).parentsUntil('.flash').remove();
      reject();
    });
  });
}

// Helper
async function apiCall(url, apiKey = null, base = null) {
  if (apiKey === null) apiKey = await getApiKey();
  if (base === null) base = await getBase();
  let pre;
  if (url.indexOf('?') !== -1) {
    pre = '&';
  } else {
    pre = '?';
  }
  url = `${base + url + pre}api_key=${apiKey}`;
  con.log('Api Call', url);
  return api.request.xhr('GET', url);
}

export const Emby: pageInterface = {
  name: 'Emby',
  domain: 'http://app.emby.media',
  languages: ['Many'],
  type: 'anime',
  isSyncPage(url) {
    if (item.Type === 'Episode') {
      return true;
    }
    return false;
  },
  sync: {
    getTitle(url) {
      return (
        item.SeriesName + (item.ParentIndexNumber > 1 ? ` Season ${item.ParentIndexNumber}` : '')
      );
    },
    getIdentifier(url) {
      if (typeof item.SeasonId !== 'undefined') return item.SeasonId;
      if (typeof item.SeriesId !== 'undefined') return item.SeriesId;
      return item.Id;
    },
    getOverviewUrl(url) {
      return `${Emby.domain}/#!/itemdetails.html?id=${Emby.sync.getIdentifier(url)}`;
    },
    getEpisode(url) {
      return item.IndexNumber;
    },
  },
  overview: {
    getTitle(url) {
      return item.SeriesName + (item.IndexNumber > 1 ? ` Season ${item.IndexNumber}` : '');
    },
    getIdentifier(url) {
      return item.Id;
    },
    uiSelector(selector) {
      j.$('.page:not(.hide) .nameContainer').first().append(j.html(selector));
    },
  },
  async init(page) {
    api.storage.addStyle(
      require('!to-string-loader!css-loader!less-loader!./style.less').toString(),
    );

    await proxy.injectScript();

    j.$(document).ready(function () {
      prepareApi().then(() => {
        con.info('Authenticated');
        utils.changeDetect(
          () => {
            page.reset();
            checkApi(page);
          },
          () => {
            const src = $('video').first().attr('src');
            if (typeof src === 'undefined') return 'NaN';
            return src;
          },
        );
        utils.urlChangeDetect(function () {
          if (
            !(window.location.href.indexOf('video') !== -1) &&
            !(window.location.href.indexOf('#dlg') !== -1)
          ) {
            page.reset();
            urlChange(page);
          }
        });
        j.$(document).ready(function () {
          utils.waitUntilTrue(
            function () {
              return j.$('.page').length;
            },
            function () {
              urlChange(page);
            },
          );
        });
        document.addEventListener('fullscreenchange', function () {
          if (
            window.fullScreen ||
            (window.innerWidth === window.screen.width &&
              window.innerHeight === window.screen.height)
          ) {
            $('html').addClass('miniMAL-Fullscreen');
          } else {
            $('html').removeClass('miniMAL-Fullscreen');
          }
        });
      });
    });
  },
};
