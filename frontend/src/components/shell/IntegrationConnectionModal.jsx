import { useEffect, useRef, useState } from 'react';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { Check, ChevronsUpDown, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

function ModalSelect({ label, value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const selectedOption = options.find((option) => option.value === value) ?? options[0] ?? null;

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  return (
    <div className="integration-field" ref={rootRef}>
      <span className="integration-field-label">{label}</span>
      <button
        className="integration-select-trigger"
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
      >
        <span className="integration-select-value">
          {selectedOption ? (
            <>
              <span className="integration-select-label">{selectedOption.label}</span>
              {selectedOption.hint ? (
                <span className="integration-select-hint">{selectedOption.hint}</span>
              ) : null}
            </>
          ) : null}
        </span>
        <ChevronsUpDown size={15} className="integration-select-chevron" />
      </button>

      {open ? (
        <div className="integration-select-menu" role="listbox">
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                className="integration-select-option"
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                <span className="integration-select-option-copy">
                  <span className="integration-select-label">{option.label}</span>
                  {option.hint ? (
                    <span className="integration-select-hint">{option.hint}</span>
                  ) : null}
                </span>
                {isSelected ? <Check size={14} className="integration-select-check" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function IntegrationConnectionModal({
  open,
  onOpenChange,
  flowType,
  onFlowTypeChange,
  connectorSelectOptions,
  selectedConnectorId,
  onConnectorChange,
  authSelectOptions,
  formState,
  onFormChange,
  onSubmit,
  selectedConnector,
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="integration-modal-backdrop" />
        <DialogPrimitive.Popup className="integration-modal-frame">
          <div className="integration-modal">
            <DialogPrimitive.Close
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="integration-modal-close"
                  type="button"
                />
              }
            >
              <XIcon />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>

            <form className="integration-sheet-form" onSubmit={onSubmit}>
              <div className="integration-sheet-header">
                <DialogPrimitive.Title className="integration-modal-title">
                  Connect Integration
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="integration-modal-description">
                  Configure a source or destination connection for this workspace.
                </DialogPrimitive.Description>
              </div>

              <div className="integration-form-grid">
                <div className="integration-field">
                  <span className="integration-field-label">Connection type</span>
                  <div className="integration-toggle-group">
                    <button
                      className={`integration-toggle-btn ${
                        flowType === 'source' ? 'is-active' : ''
                      }`}
                      type="button"
                      onClick={() => onFlowTypeChange('source')}
                    >
                      Source
                    </button>
                    <button
                      className={`integration-toggle-btn ${
                        flowType === 'destination' ? 'is-active' : ''
                      }`}
                      type="button"
                      onClick={() => onFlowTypeChange('destination')}
                    >
                      Destination
                    </button>
                  </div>
                </div>

                <ModalSelect
                  label="Connector"
                  value={selectedConnectorId}
                  options={connectorSelectOptions}
                  onChange={onConnectorChange}
                />

                <label className="integration-field">
                  <span className="integration-field-label">Connection name</span>
                  <Input
                    className="integration-input"
                    value={formState.displayName}
                    onChange={(event) => onFormChange('displayName', event.target.value)}
                    placeholder={selectedConnector?.name ?? 'Stripe Production'}
                  />
                </label>

                <label className="integration-field">
                  <span className="integration-field-label">
                    {flowType === 'source' ? 'Workspace / account' : 'Target workspace'}
                  </span>
                  <Input
                    className="integration-input"
                    value={formState.scope}
                    onChange={(event) => onFormChange('scope', event.target.value)}
                    placeholder={flowType === 'source' ? 'prod-store-eu' : '#revenue-alerts'}
                  />
                </label>

                <ModalSelect
                  label="Auth method"
                  value={formState.authMethod}
                  options={authSelectOptions}
                  onChange={(nextValue) => onFormChange('authMethod', nextValue)}
                />

                <label className="integration-field">
                  <span className="integration-field-label">Credentials / configuration</span>
                  <Textarea
                    className="integration-textarea"
                    value={formState.credentials}
                    onChange={(event) => onFormChange('credentials', event.target.value)}
                    placeholder='{"apiKey":"••••••••","accountId":"acct_123"}'
                  />
                </label>

                <label className="integration-field">
                  <span className="integration-field-label">Notes</span>
                  <Textarea
                    className="integration-textarea"
                    value={formState.notes}
                    onChange={(event) => onFormChange('notes', event.target.value)}
                    placeholder="Optional context shown in the connected integrations list."
                  />
                </label>
              </div>

              <div className="integration-sheet-footer">
                <Button
                  type="button"
                  variant="outline"
                  className="integration-modal-secondary-btn"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" className="integration-modal-primary-btn">
                  Connect
                </Button>
              </div>
            </form>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
