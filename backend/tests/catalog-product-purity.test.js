const {
  sanitizeCatalogProductPurity,
  sanitizeInventoryCategoryPurity,
} = require('../utils/catalogProductPurity')

describe('catalogProductPurity', () => {
  test('replaces fine leak on karat names', () => {
    expect(sanitizeCatalogProductPurity({ productName: '14k alloy', productPurity: '1' })).toBe('0.583333')
    expect(sanitizeCatalogProductPurity({ productName: '22k Chain', productPurity: '1.0' })).toBe('0.916667')
  })

  test('keeps fine purity for Pure Gold', () => {
    expect(sanitizeCatalogProductPurity({ productName: 'Pure Gold', productPurity: '1' })).toBe('1')
  })

  test('rewrites category productPurity token', () => {
    const cat = 'mainStock=gold;recordType=product;productPurity=1;taxType=VAT'
    expect(sanitizeInventoryCategoryPurity(cat, '14k bangle')).toContain('productPurity=0.583333')
    expect(sanitizeInventoryCategoryPurity(cat, 'Pure Gold')).toContain('productPurity=1')
  })
})
