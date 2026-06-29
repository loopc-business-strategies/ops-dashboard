import { buildErpTabPanelProps } from './buildErpTabPanelProps'
import { buildErpTabModalProps } from './buildErpTabModalProps'

export function useErpTabBindings(scope) {
  return {
    panelProps: buildErpTabPanelProps(scope),
    modalProps: buildErpTabModalProps(scope),
  }
}
