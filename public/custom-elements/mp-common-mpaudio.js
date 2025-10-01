function formatDuration(duration) {
  if (duration < 60) return duration + '秒';
  if (duration < 3600) return Math.floor(duration / 60) + '分钟';
  let hours = Math.floor(duration / 3600),
    minutes = Math.floor((duration - 3600 * hours) / 60);
  return hours + '小时' + (minutes > 0 ? minutes + '分钟' : '');
}
function pad(num) {
  return num < 10 ? `0${num}` : num;
}

function formatTimeGap(seconds) {
  const s = seconds % 60;
  const m = (seconds - s) / 60;

  return `${pad(m)}:${pad(s)}`;
}

class MpCommonMpaudio extends HTMLElement {
  constructor() {
    super();

    this._boundOnClick = this._onClick.bind(this);

    /**
     * 需要 playing 和 stopped 2个状态
     * stopped 为初始状态，表示停止
     * playing 表示是否正在播放
     * 这两个状态组成了3种组合:
     * - stopped: true 初始状态
     * - stopped: false 且 playing: true 播放状态
     * - stopped: false 且 playing: false 暂停状态
     */
    this._internals = this.attachInternals();

    this._internals.states.add('stopped');
  }

  get name() {
    return this.getAttribute('name');
  }
  get author() {
    return this.getAttribute('author');
  }
  get src() {
    return this.getAttribute('src');
  }
  get isaac2() {
    return this.getAttribute('isaac2');
  }
  get low_size() {
    return this.getAttribute('low_size');
  }
  get source_size() {
    return this.getAttribute('source_size');
  }
  get high_size() {
    return this.getAttribute('high_size');
  }
  get play_length() {
    return this.getAttribute('play_length');
  }
  get trans_state() {
    return this.getAttribute('data-trans_state');
  }
  get verify_state() {
    return this.getAttribute('data-verify_state');
  }
  get posIndex() {
    return this.getAttribute('pos_index');
  }
  get duration() {
    return this.getAttribute('duration');
  }
  get showListenLater() {
    return this.getAttribute('show-listen-later');
  }
  get hasAddedListenLater() {
    return this.getAttribute('has-added-listen-later');
  }
  get albumId() {
    return this.getAttribute('data-topic_id');
  }
  get albumTitle() {
    return this.getAttribute('data-topic_name');
  }
  get albumLink() {
    return this.getAttribute('data-topic_link');
  }
  get albumNum() {
    return this.getAttribute('data-topic_num');
  }
  get errTips() {
    return this.getAttribute('err_tips');
  }
  get fileid() {
    return this.getAttribute('voice_encode_fileid');
  }
  get cover() {
    return this.getAttribute('cover');
  }
  get dataPluginname() {
    return this.getAttribute('data-pluginname');
  }
  get is_hover() {
    return this.getAttribute('data-is-hover');
  }
  get is_selected() {
    return this.getAttribute('data-is-selected');
  }

  get verifyErr() {
    return this.errTips
      ? this.errTips
      : '1' === this.verify_state || '2' === this.verify_state || '4' === this.verify_state
        ? '当前音频暂时无法播放'
        : '5' === this.verify_state
          ? '当前音频已被作者删除'
          : '0' === this.verify_state
            ? '当前音频转码中'
            : '2' === this.verify_state
              ? '当前音频转码失败'
              : '';
  }

  get duration_str() {
    return this.duration
      ? formatDuration(Math.floor(parseInt(this.duration, 10)))
      : this.play_length
        ? formatDuration(Math.floor(parseInt(this.play_length, 10) / 1e3))
        : '';
  }

  /**
   * 音频的总时长，单位：秒
   * @return {number}
   */
  get seconds() {
    if (this.duration) {
      return Math.floor(parseInt(this.duration, 10));
    } else if (this.play_length) {
      return Math.floor(parseInt(this.play_length, 10) / 1e3);
    } else {
      return 0;
    }
  }

  _onClick() {
    if (this.stopped) {
      this.stopped = false;
      this.playing = true;
    } else {
      this.playing = !this.playing;
    }

    if (this.playing) {
      this.shadow.querySelector('audio').play();
    } else {
      this.shadow.querySelector('audio').pause();
    }
  }

  get playing() {
    return this._internals.states.has('playing');
  }
  set playing(value) {
    if (value) {
      this._internals.states.add('playing');

      this.shadow.querySelector('.wx-root').classList.remove('share_audio_pause');
      this.shadow.querySelector('.wx-root').classList.add('share_audio_playing');
    } else {
      this._internals.states.delete('playing');

      this.shadow.querySelector('.wx-root').classList.remove('share_audio_playing');
      this.shadow.querySelector('.wx-root').classList.add('share_audio_pause');
    }
  }

  get stopped() {
    return this._internals.states.has('stopped');
  }
  set stopped(value) {
    if (value) {
      this._internals.states.add('stopped');
    } else {
      this._internals.states.delete('stopped');
    }
  }

  connectedCallback() {
    let template = document.getElementById('mp-common-mpaudio');
    let templateContent = template.content;

    this.addEventListener('click', this._boundOnClick);

    this.shadow = this.attachShadow({ mode: 'open' });
    this.shadow.appendChild(templateContent.cloneNode(true));

    this.shadow.querySelector('.audio_card_title').textContent = this.name;
    this.shadow.querySelector('.audio_card_nickname_inner').textContent = this.author;
    this.shadow.querySelector('.audio_card_thumb').src = this.cover;

    const audio = this.shadow.querySelector('audio');
    audio.src = this.src;

    audio.addEventListener('play', () => {
      this.shadow.querySelector('#audio_progress_bar').style.display = 'block';
      this.shadow.querySelector('.js_duration1').style.display = 'none';
      this.shadow.querySelector('.js_duration2').style.display = 'block';
    });
    audio.addEventListener('ended', () => {
      this.stopped = true;
      this.playing = false;
      this.shadow.querySelector('#audio_progress_bar').style.display = 'none';
      this.shadow.querySelector('.js_duration1').style.display = 'block';
      this.shadow.querySelector('.js_duration2').style.display = 'none';
    });
    audio.addEventListener('timeupdate', () => {
      this.shadow.querySelector('.js_duration2 .start').textContent = formatTimeGap(Math.round(audio.currentTime));
      // 更新进度条
      const percent = ((audio.currentTime / this.seconds) * 100).toFixed(2);
      this.shadow.querySelector('#voice_percent').textContent = `${percent}%`;
      this.shadow.querySelector('#voice_progress').style.width = `${percent}%`;
      this.shadow.querySelector('#voice_playdot').style.left = `${percent}%`;
    });

    this.shadow.querySelector('.js_duration1 > .text').textContent = this.duration_str;
    this.shadow.querySelector('.js_duration2 .end').textContent = formatTimeGap(this.seconds);
  }

  disconnectedCallback() {
    this.shadow.innerHTML = '';
    this.removeEventListener('click', this._boundOnClick);
  }
}

customElements.define('mp-common-mpaudio', MpCommonMpaudio);
