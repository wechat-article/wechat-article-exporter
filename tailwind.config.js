/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [],
  theme: {
    extend: {
      colors: {
        slate: {
          1: '#00005503',
          2: '#00005506',
          3: '#0000330f',
          4: '#00002d17',
          5: '#0009321f',
          6: '#00002f26',
          7: '#00062e32',
          8: '#00083046',
          9: '#00051d74',
          10: '#00071b7f',
          11: '#0007149f',
          12: '#000509e3',
        },
      },
    },
    debugScreens: {
      position: ['bottom', 'left'],
      style: {
        backgroundColor: 'black',
        color: 'white',
        fontSize: '16px',
        padding: '0.5rem',
        borderRadius: '0.25rem',
      },
    },
  },
  // plugins: [require('tailwindcss-debug-screens')],
};
