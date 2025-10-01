import type { ArticleItem } from '~/types/album';
import type { RGB } from '~/types/types';

function padLeft(num: number, len: number = 2) {
  if (num.toString().length >= len) {
    return num.toString();
  }
  return '0'.repeat(len - num.toString().length) + num.toString();
}

export function formatAlbumTime(timestamp: number) {
  const currentSeconds = Math.round(new Date().getTime() / 1000),
    now = new Date(1000 * currentSeconds),
    o = new Date(1000 * timestamp),
    r = {
      year: o.getFullYear(),
      month: padLeft(o.getMonth() + 1),
      date: padLeft(o.getDate()),
    };

  now.setHours(0);
  now.setMinutes(0);
  now.setSeconds(0);
  var i = now.getTime() / 1000;
  now.setDate(1);
  now.setMonth(0);
  const s = now.getTime() / 1000;
  return [
    {
      date: i,
      text: 'Today',
    },
    {
      date: i - 86400,
      text: 'Yesterday',
    },
    {
      date: i - 172800,
      text: '2 days ago',
    },
    {
      date: i - 518400,
      text: Math.floor((i - timestamp) / 86400) + '天前',
    },
    {
      date: i - 1209600,
      text: '1 week ago',
    },
    {
      date: s,
      text: r.month + '/' + r.date,
    },
    {
      date: 0,
      text: r.year + '/' + r.month + '/' + r.date,
    },
  ].reduce(function (result, item) {
    if (!result && timestamp >= item.date) {
      result = item.text;
    }
    return result;
  }, '');
}

function theme(article: ArticleItem) {
  // let color: RGB = article.cover_theme_color || {
  //     r: 255,
  //     g: 255,
  //     b: 255
  // }
  // var color_r = color.r,
  //     color_g = color.g,
  //     color_b = color.b,
  //     p = h(color_r, color_g, color_b),
  //     f = _slicedToArray(p, 3),
  //     w = (f[0], f[1], f[2]),
  //     k = Math.min(100 * w, 30) / 100,
  //     L = (Math.min(100 * w, 30) + 10) / 100,
  //     gradient1 = e(v(+color_r, +color_g, +color_b, k), 1),
  //     gradient2 = e(v(+color_r, +color_g, +color_b, L), 1);
  //
  // const value = "linear-gradient(to bottom, " + gradient1 + ", " + gradient2 + ")"
}
