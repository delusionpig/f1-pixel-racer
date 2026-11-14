const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(`${__dirname}/game.js`, 'utf8');
const audioLoader = source.slice(source.indexOf('  function loadAudio('), source.indexOf('  async function loadBirthdayVideo('));
const assetLoader = source.slice(source.indexOf('  async function loadAllAssets('), source.indexOf('  function drawPixelRoad('));

async function check() {
  const audio = new EventTarget();
  audio.readyState = 0;
  audio.error = null;
  let reloads = 0;
  audio.load = () => { reloads++; };
  const context = vm.createContext({ HTMLMediaElement: { HAVE_FUTURE_DATA: 3 } });
  vm.runInContext(audioLoader, context);
  const ready = context.loadAudio(audio, 'BGM');
  assert.equal(reloads, 0, 'Do not restart audio already loading or playing');
  audio.dispatchEvent(new Event('canplay'));
  assert.equal(await ready, 'BGM');
  audio.readyState = 3;
  assert.equal(await context.loadAudio(audio, 'BGM'), 'BGM');
  audio.readyState = 0;
  audio.error = new Error('network');
  const failed = context.loadAudio(audio, 'BGM');
  assert.equal(reloads, 1, 'Retry failed audio loads');
  audio.dispatchEvent(new Event('error'));
  await assert.rejects(failed, /BGM加载失败/);

  const events = [];
  let allowMusic;
  const musicReady = new Promise(resolve => { allowMusic = resolve; });
  const element = (hidden = true) => {
    const classes = new Set(hidden ? ['hidden'] : []);
    return { classList: {
      add: name => classes.add(name), remove: name => classes.delete(name),
      contains: name => classes.has(name),
      toggle: (name, force) => force ? classes.add(name) : classes.delete(name)
    } };
  };
  Object.assign(context, {
    teamPrepared: false, prepareCard: element(false),
    loadingCard: element(), loadingBackdrop: element(), startCard: element(),
    loadingRetry: element(), startButton: {}, startHint: {}, backgroundMusic: audio,
    totalAssets: 3, setLoadingProgress() {},
    loadAudio: () => { events.push('music-load'); return musicReady; },
    startBackgroundMusic: () => { events.push('music-play'); return new Promise(() => {}); },
    assetImages: [[{}, 'image.png', 'image']],
    loadImage: async () => { events.push('image-load'); },
    loadBirthdayVideo: async () => { events.push('video-load'); }
  });
  vm.runInContext(assetLoader, context);
  const loading = context.loadAllAssets();
  assert.deepEqual(events, ['music-load', 'image-load', 'video-load']);
  assert.equal(context.loadingCard.classList.contains('hidden'), true);
  context.prepareTeam();
  assert.equal(events.at(-1), 'music-play', 'Play directly in the preparation click');
  assert.equal(context.prepareCard.classList.contains('hidden'), true);
  assert.equal(context.loadingCard.classList.contains('hidden'), false);
  allowMusic();
  await loading;
  assert.equal(context.assetsReady, true, 'Pending playback must not block asset loading');
  assert.equal(context.startCard.classList.contains('hidden'), false);

  context.teamPrepared = false;
  context.prepareCard = element(false);
  context.startCard = element();
  await context.loadAllAssets();
  assert.equal(context.prepareCard.classList.contains('hidden'), false);
  assert.equal(context.startCard.classList.contains('hidden'), true, 'Stay at entrance until clicked');
  context.prepareTeam();
  assert.equal(context.startCard.classList.contains('hidden'), false, 'Cached assets skip loading screen');

  context.teamPrepared = false;
  context.prepareCard = element(false);
  context.loadImage = async () => { throw new Error('image failed'); };
  await context.loadAllAssets();
  assert.equal(context.loadingRetry.classList.contains('hidden'), false);
  context.prepareTeam();
  assert.equal(context.loadingCard.classList.contains('hidden'), false, 'Reveal failed load and retry after click');
  console.log('Audio loading checks passed');
}

check().catch(error => { console.error(error); process.exitCode = 1; });
