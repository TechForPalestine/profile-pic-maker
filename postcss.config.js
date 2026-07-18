module.exports = {
  plugins: {
    // Tailwind CSS v4 moved its PostCSS plugin out of the `tailwindcss`
    // package. Vendor prefixing is built in, so autoprefixer is gone too.
    '@tailwindcss/postcss': {},
  },
};
