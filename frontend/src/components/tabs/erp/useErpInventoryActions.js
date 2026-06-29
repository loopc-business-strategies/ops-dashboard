import { useCallback, useEffect, useRef } from 'react'
import erpAccountingAPI from '../../../api/erp-accounting'
import {
  buildAutoStockCode,
  buildUniqueStockCode,
  createInventoryMappingForm,
  createInventoryProductForm,
  resolveMainStockValueFromForm,
} from './erpTabUtils'
import {
  buildCatalogProductPayload,
  buildInventoryMappingPayload,
  computeInventoryProductPurityWeight,
  mappingProductToFormState,
  resolveCatalogProductEditForm,
} from './inventoryFormDefaults'

function useModalDrag({
  modalOffset,
  setModalOffset,
  setModalDragging,
}) {
  const dragRef = useRef({ moveHandler: null, upHandler: null })

  const stopDrag = useCallback(() => {
    const { moveHandler, upHandler } = dragRef.current
    if (moveHandler) window.removeEventListener('mousemove', moveHandler)
    if (upHandler) window.removeEventListener('mouseup', upHandler)
    dragRef.current = { moveHandler: null, upHandler: null }
    setModalDragging(false)
  }, [setModalDragging])

  const handleDragStart = useCallback((event) => {
    if (event.button !== 0) return
    event.preventDefault()
    const startX = event.clientX
    const startY = event.clientY
    const originX = modalOffset.x
    const originY = modalOffset.y
    const moveHandler = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX
      const deltaY = moveEvent.clientY - startY
      setModalOffset({ x: originX + deltaX, y: originY + deltaY })
    }
    const upHandler = () => {
      stopDrag()
    }
    stopDrag()
    setModalDragging(true)
    dragRef.current = { moveHandler, upHandler }
    window.addEventListener('mousemove', moveHandler)
    window.addEventListener('mouseup', upHandler)
  }, [modalOffset, setModalOffset, setModalDragging, stopDrag])

  return { stopDrag, handleDragStart }
}

export function useErpInventoryActions({
  token,
  isSuperAdmin,
  inventoryMappingForm,
  inventoryProductForm,
  inventoryMappingProducts,
  inventoryCatalogProducts,
  inventoryStockCodeSettings,
  inventoryStockCodeManualOverride,
  editingProductId,
  editingInventoryProductId,
  selectedInventoryStockType,
  showInventoryMappingModal,
  inventoryModalOffset,
  inventoryProductModalOffset,
  setInventoryMappingForm,
  setInventoryProductForm,
  setInventoryStockCodeManualOverride,
  setInventoryModalOffset,
  setInventoryModalDragging,
  setInventoryProductModalOffset,
  setInventoryProductModalDragging,
  setEditingProductId,
  setEditingInventoryProductId,
  setShowInventoryMappingModal,
  setShowInventoryProductModal,
  setSaving,
  setError,
  showNotification,
  loadInventory,
}) {
  const mappingDrag = useModalDrag({
    modalOffset: inventoryModalOffset,
    setModalOffset: setInventoryModalOffset,
    setModalDragging: setInventoryModalDragging,
  })
  const productDrag = useModalDrag({
    modalOffset: inventoryProductModalOffset,
    setModalOffset: setInventoryProductModalOffset,
    setModalDragging: setInventoryProductModalDragging,
  })

  const mappingStopRef = useRef(() => {})
  const productStopRef = useRef(() => {})
  mappingStopRef.current = mappingDrag.stopDrag
  productStopRef.current = productDrag.stopDrag

  useEffect(() => () => {
    mappingStopRef.current()
    productStopRef.current()
  }, [])

  useEffect(() => {
    if (!showInventoryMappingModal) return
    if (isSuperAdmin && inventoryStockCodeManualOverride) return
    const baseCode = buildAutoStockCode(inventoryMappingForm, inventoryStockCodeSettings)
    const nextCode = buildUniqueStockCode(baseCode, inventoryMappingProducts, editingProductId)
    setInventoryMappingForm((prev) => (prev.stockCode === nextCode ? prev : { ...prev, stockCode: nextCode }))
  // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to stock-driving fields, not whole form object
  }, [
    showInventoryMappingModal,
    inventoryMappingForm.mainStock,
    inventoryMappingForm.customMainStock,
    inventoryMappingForm.metalType,
    inventoryMappingProducts,
    editingProductId,
    inventoryStockCodeSettings,
    isSuperAdmin,
    inventoryStockCodeManualOverride,
    setInventoryMappingForm,
  ])

  const resetInventoryMappingForm = useCallback(() => {
    setEditingProductId('')
    setInventoryMappingForm(createInventoryMappingForm())
    setInventoryStockCodeManualOverride(false)
    setInventoryModalOffset({ x: 0, y: 0 })
    setInventoryModalDragging(false)
    setShowInventoryMappingModal(false)
  }, [
    setEditingProductId,
    setInventoryMappingForm,
    setInventoryStockCodeManualOverride,
    setInventoryModalOffset,
    setInventoryModalDragging,
    setShowInventoryMappingModal,
  ])

  const resetInventoryProductForm = useCallback(() => {
    setEditingInventoryProductId('')
    setInventoryProductForm(createInventoryProductForm())
    setInventoryProductModalOffset({ x: 0, y: 0 })
    setInventoryProductModalDragging(false)
    setShowInventoryProductModal(false)
  }, [
    setEditingInventoryProductId,
    setInventoryProductForm,
    setInventoryProductModalOffset,
    setInventoryProductModalDragging,
    setShowInventoryProductModal,
  ])

  const handleCreateProduct = useCallback(async (e) => {
    e.preventDefault()
    const mainStockValue = resolveMainStockValueFromForm(inventoryMappingForm)
    if (!mainStockValue) {
      setError('Main stock is required')
      return
    }
    if (!inventoryMappingForm.stockCode.trim()) {
      setError('Stock code is required')
      return
    }
    const duplicateStockCode = inventoryMappingProducts.find((item) => (
      String(item.sku || '').trim().toLowerCase() === String(inventoryMappingForm.stockCode || '').trim().toLowerCase()
      && item._id !== editingProductId
    ))
    if (duplicateStockCode) {
      setError('Stock code already exists. Use a unique stock code.')
      return
    }
    try {
      setSaving(true)
      const payload = buildInventoryMappingPayload({
        form: inventoryMappingForm,
        includeOpeningQty: !editingProductId,
        inventoryStockCodeSettings,
        inventoryMappingProducts,
        editingProductId,
        isSuperAdmin,
      })
      if (editingProductId) {
        await erpAccountingAPI.updateInventoryProduct(token, editingProductId, payload)
        showNotification('✅ Stock mapping updated')
      } else {
        await erpAccountingAPI.createInventoryProduct(token, payload)
        showNotification('✅ Stock mapping created')
      }
      resetInventoryMappingForm()
      await loadInventory()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save stock mapping')
    } finally {
      setSaving(false)
    }
  }, [
    token,
    inventoryMappingForm,
    inventoryMappingProducts,
    editingProductId,
    inventoryStockCodeSettings,
    isSuperAdmin,
    setSaving,
    setError,
    showNotification,
    resetInventoryMappingForm,
    loadInventory,
  ])

  const handleEditProduct = useCallback((product) => {
    setEditingProductId(product._id)
    setInventoryMappingForm(mappingProductToFormState(product))
    setInventoryStockCodeManualOverride(false)
    setInventoryModalOffset({ x: 0, y: 0 })
    setShowInventoryMappingModal(true)
  }, [
    setEditingProductId,
    setInventoryMappingForm,
    setInventoryStockCodeManualOverride,
    setInventoryModalOffset,
    setShowInventoryMappingModal,
  ])

  const handleDeleteProduct = useCallback(async (product) => {
    if (!window.confirm(`Delete product "${product.name}"? This cannot be undone.`)) return
    try {
      setSaving(true)
      await erpAccountingAPI.deleteInventoryProduct(token, product._id)
      await loadInventory()
      showNotification('✅ Stock mapping deleted')
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete stock mapping')
    } finally {
      setSaving(false)
    }
  }, [token, setSaving, setError, showNotification, loadInventory])

  const handleCreateInventoryCatalogProduct = useCallback(async (e) => {
    e.preventDefault()
    if (!inventoryProductForm.name.trim()) {
      setError('Product name is required')
      return
    }
    if (!inventoryProductForm.stockTypeId && !editingInventoryProductId) {
      setError('Product category is required')
      return
    }
    const selectedStockType = inventoryMappingProducts.find((item) => item._id === inventoryProductForm.stockTypeId)
    if (!selectedStockType && !editingInventoryProductId) {
      setError('Product category is required')
      return
    }
    const productPurityWeight = computeInventoryProductPurityWeight(inventoryProductForm)
    try {
      setSaving(true)
      const payload = buildCatalogProductPayload({
        inventoryProductForm,
        inventoryMappingProducts,
        inventoryCatalogProducts,
        editingInventoryProductId,
        selectedInventoryStockType,
        productPurityWeight,
      })
      if (editingInventoryProductId) {
        await erpAccountingAPI.updateInventoryProduct(token, editingInventoryProductId, payload)
        showNotification('✅ Product updated')
      } else {
        await erpAccountingAPI.createInventoryProduct(token, payload)
        showNotification('✅ Product created')
      }
      resetInventoryProductForm()
      await loadInventory()
    } catch (err) {
      setError(err.response?.data?.message || `Failed to ${editingInventoryProductId ? 'update' : 'create'} product`)
    } finally {
      setSaving(false)
    }
  }, [
    token,
    inventoryProductForm,
    inventoryMappingProducts,
    inventoryCatalogProducts,
    editingInventoryProductId,
    selectedInventoryStockType,
    setSaving,
    setError,
    showNotification,
    resetInventoryProductForm,
    loadInventory,
  ])

  const handleEditInventoryCatalogProduct = useCallback((productItem, productMeta) => {
    setEditingInventoryProductId(productItem._id)
    setInventoryProductForm(resolveCatalogProductEditForm({
      productItem,
      productMeta,
      inventoryMappingProducts,
    }))
    setInventoryProductModalOffset({ x: 0, y: 0 })
    setShowInventoryProductModal(true)
  }, [
    inventoryMappingProducts,
    setEditingInventoryProductId,
    setInventoryProductForm,
    setInventoryProductModalOffset,
    setShowInventoryProductModal,
  ])

  const handleDeleteInventoryCatalogProduct = useCallback(async (productItem) => {
    if (!window.confirm(`Delete product "${productItem?.name || 'Unnamed'}"? This cannot be undone.`)) return
    try {
      setSaving(true)
      await erpAccountingAPI.deleteInventoryProduct(token, productItem._id)
      if (editingInventoryProductId && String(editingInventoryProductId) === String(productItem._id)) {
        resetInventoryProductForm()
      }
      await loadInventory()
      showNotification('✅ Product deleted')
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete product')
    } finally {
      setSaving(false)
    }
  }, [
    token,
    editingInventoryProductId,
    setSaving,
    setError,
    showNotification,
    resetInventoryProductForm,
    loadInventory,
  ])

  return {
    resetInventoryMappingForm,
    resetInventoryProductForm,
    handleInventoryModalDragStart: mappingDrag.handleDragStart,
    handleInventoryProductModalDragStart: productDrag.handleDragStart,
    handleCreateProduct,
    handleEditProduct,
    handleDeleteProduct,
    handleCreateInventoryCatalogProduct,
    handleEditInventoryCatalogProduct,
    handleDeleteInventoryCatalogProduct,
  }
}
