module.exports = {
  plugins: [
    '@trivago/prettier-plugin-sort-imports',
    'prettier-plugin-tailwindcss',
  ],
  semi: false,
  singleQuote: true,
  trailingComma: 'all',
  importOrderSeparation: true,
  importOrderSortSpecifiers: true,
  endOfLine: 'lf',
}
