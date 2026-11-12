import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useCart } from '../context/CartContext.js';
import { useTheme } from '../context/ThemeContext.js';

const currencyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

interface OptionValue {
  id: string;
  name: string;
  priceModifier: number;
  isDefault: boolean;
  sortOrder: number;
}

interface MenuOption {
  id: string;
  name: string;
  displayType: 'SELECT' | 'RADIO' | 'CHECKBOX' | 'QUANTITY';
  isRequired: boolean;
  minSelect: number;
  maxSelect: number;
  sortOrder: number;
  values: OptionValue[];
}

interface Allergen {
  allergen: { id: string; name: string };
}

interface MenuItemDetail {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  image: string | null;
  images?: string[];
  isActive: boolean;
  category: { id: string; name: string };
  options: MenuOption[];
  allergens: Allergen[];
}

interface Props {
  itemId: string;
  onClose: () => void;
}

function formatPublicCategoryLabel(value: string): string {
  return value
    .replace(/^\s*\d+[_\-\s]+/, '')
    .replace(/_+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export default function MenuItemModal({ itemId, onClose }: Props) {
  const { settings: themeSettings } = useTheme();
  const content = themeSettings.storefrontContent;
  const { t } = useTranslation();
  const { addItem } = useCart();
  const [item, setItem] = useState<MenuItemDetail | null>(null);
  const [activeImage, setActiveImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [selections, setSelections] = useState<Record<string, string[]>>({});

  useEffect(() => {
    setLoading(true);
    fetch(`/api/menu/items/${itemId}`)
      .then((res) => {
        if (!res.ok) throw new Error('No fue posible cargar este producto.');
        return res.json();
      })
      .then((json) => {
        setItem(json.data);
        const gallery = Array.isArray(json.data.images) ? json.data.images : [];
        setActiveImage(gallery[0] || json.data.image || null);
        // Set defaults
        const defaults: Record<string, string[]> = {};
        for (const opt of json.data.options) {
          const defaultVals = opt.values.filter((v: OptionValue) => v.isDefault).map((v: OptionValue) => v.id);
          if (defaultVals.length > 0) {
            defaults[opt.id] = defaultVals;
          } else if (opt.isRequired && (opt.displayType === 'SELECT' || opt.displayType === 'RADIO')) {
            defaults[opt.id] = [opt.values[0]?.id].filter(Boolean);
          }
        }
        setSelections(defaults);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [itemId]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [handleKeyDown]);

  function handleSelect(optionId: string, valueId: string, displayType: string, maxSelect: number) {
    setSelections((prev) => {
      const current = prev[optionId] || [];
      if (displayType === 'SELECT' || displayType === 'RADIO') {
        return { ...prev, [optionId]: [valueId] };
      }
      // CHECKBOX
      if (current.includes(valueId)) {
        return { ...prev, [optionId]: current.filter((id) => id !== valueId) };
      }
      if (current.length >= maxSelect) {
        return prev;
      }
      return { ...prev, [optionId]: [...current, valueId] };
    });
  }

  function handleAddToCart() {
    if (!item) return;
    const cartOptions = item.options.flatMap((opt) => {
      const selected = selections[opt.id] || [];
      return opt.values
        .filter((v) => selected.includes(v.id))
        .map((v) => ({
          optionId: opt.id,
          optionName: opt.name,
          valueId: v.id,
          valueName: v.name,
          priceModifier: v.priceModifier,
        }));
    });
    addItem({
      menuItemId: item.id,
      name: item.name,
      price: item.price,
      quantity,
      options: cartOptions,
    });
    onClose();
  }

  function calculateTotal(): number {
    if (!item) return 0;
    let total = item.price;
    for (const opt of item.options) {
      const selected = selections[opt.id] || [];
      for (const val of opt.values) {
        if (selected.includes(val.id)) {
          total += val.priceModifier;
        }
      }
    }
    return total * quantity;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-x-hidden bg-[#211019]/75 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        data-ld-product-modal
        className="ld-product-modal relative w-full min-w-0 max-h-[94vh] overflow-x-hidden overflow-y-auto overscroll-contain rounded-t-[1.8rem] border border-[#E7B75C]/30 bg-white shadow-[0_28px_90px_rgba(20,8,15,0.35)] sm:max-w-5xl sm:rounded-[1.8rem]"
        onClick={(e) => e.stopPropagation()}
      >
        {loading && (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="p-6">
            <div className="bg-red-50 text-red-700 p-4 rounded-lg">{error}</div>
            <button onClick={onClose} className="mt-4 text-sm text-gray-500 hover:text-gray-700">
              Cerrar
            </button>
          </div>
        )}

        {item && (
          <>
            {/* Galería de imágenes del producto */}
            <div data-ld-product-media className="relative bg-[#FFF7EE]">
              <div className="relative h-64 w-full min-w-0 sm:h-72">
                {(activeImage || item.image) ? (
                  <img src={activeImage || item.image || undefined} alt={item.name} className="block h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#FFF0D1] to-[#F7DDE0] text-6xl" aria-hidden="true">{content.catalogProductPlaceholderEmoji}</div>
                )}
              </div>
              {((item.images?.length || 0) > 1) && (
                <div className="grid grid-cols-3 gap-2 px-4 py-3 sm:grid-cols-6">
                  {item.images?.slice(0, 6).map((image, index) => (
                    <button key={`${image}-${index}`} type="button" onClick={() => setActiveImage(image)} aria-label={`Ver fotografía ${index + 1} de ${item.name}`} aria-pressed={activeImage === image} className={`mx-auto aspect-square w-full max-w-[5rem] min-w-0 overflow-hidden rounded-xl border-2 transition ${activeImage === image ? 'border-[#BD1748] ring-2 ring-[#F7DDE0]' : 'border-white opacity-75 hover:opacity-100'}`}>
                      <img src={image} alt={`${item.name}, fotografía ${index + 1}`} className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
              <button
                onClick={onClose}
                className="absolute top-3 right-3 bg-white/80 hover:bg-white rounded-full p-1.5 transition-colors"
                aria-label="Cerrar"
              >
                <svg className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div data-ld-product-content className="ld-product-content min-w-0 p-4 sm:p-7">
              <div className="mb-2 flex min-w-0 flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                <h2 className="min-w-0 flex-1 break-words text-xl font-black text-[#321522] [overflow-wrap:anywhere] sm:text-2xl">{item.name}</h2>
                <span className="shrink-0 whitespace-nowrap text-xl font-black text-[#A71942]">{currencyFormatter.format(item.price)}</span>
              </div>

              <span className="inline-flex rounded-full border border-[#E7B75C]/50 bg-[#FFF9ED] px-3 py-1 text-xs font-bold text-[#754D20]">
                {formatPublicCategoryLabel(item.category.name)}
              </span>

              {item.description && (
                <p className="mt-3 break-words text-sm leading-6 text-[#6C5B5C] [overflow-wrap:anywhere]">{item.description}</p>
              )}

              {/* Allergens */}
              {item.allergens.length > 0 && (
                <div className="mt-4">
                  <div className="flex flex-wrap gap-1.5">
                    {item.allergens.map((a) => (
                      <span
                        key={a.allergen.id}
                        className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200"
                      >
                        {a.allergen.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Options */}
              {item.options.length > 0 && (
                <div className="mt-6 space-y-5">
                  {item.options.map((opt) => (
                    <div key={opt.id}>
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-sm font-semibold text-gray-900">{opt.name}</h3>
                        {opt.isRequired && (
                          <span className="text-xs text-red-500 font-medium">{t('common.required')}</span>
                        )}
                      </div>

                      {(opt.displayType === 'SELECT') ? (
                        <select
                          value={(selections[opt.id] || [])[0] || ''}
                          onChange={(e) => handleSelect(opt.id, e.target.value, opt.displayType, opt.maxSelect)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                        >
                          {!opt.isRequired && <option value="">Ninguna</option>}
                          {opt.values.map((val) => (
                            <option key={val.id} value={val.id}>
                              {val.name}
                              {val.priceModifier !== 0 && ` (+${currencyFormatter.format(val.priceModifier)})`}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="space-y-2">
                          {opt.values.map((val) => {
                            const isSelected = (selections[opt.id] || []).includes(val.id);
                            const isRadio = opt.displayType === 'RADIO';
                            return (
                              <label
                                key={val.id}
                                className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                                  isSelected
                                    ? 'border-primary-300 bg-primary-50'
                                    : 'border-gray-200 hover:border-gray-300'
                                }`}
                              >
                                <input
                                  type={isRadio ? 'radio' : 'checkbox'}
                                  name={`option-${opt.id}`}
                                  checked={isSelected}
                                  onChange={() => handleSelect(opt.id, val.id, opt.displayType, opt.maxSelect)}
                                  className="accent-primary-600"
                                />
                                <span className="text-sm text-gray-900 flex-1">{val.name}</span>
                                {val.priceModifier !== 0 && (
                                  <span className="text-xs text-gray-500">
                                    +${currencyFormatter.format(val.priceModifier)}
                                  </span>
                                )}
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Quantity & Add to cart */}
              <div data-ld-modal-actions className="ld-modal-actions mt-6 border-t border-gray-200 pt-4">
                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-start">
                    <button
                      type="button"
                      aria-label="Disminuir cantidad"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      className="ld-quantity-button ld-quantity-button--decrease"
                    >
                      -
                    </button>
                    <span className="w-8 text-center text-lg font-black text-[#321522]">{quantity}</span>
                    <button
                      type="button"
                      aria-label="Aumentar cantidad"
                      onClick={() => setQuantity((q) => q + 1)}
                      className="ld-quantity-button ld-quantity-button--increase"
                    >
                      +
                    </button>
                  </div>
                  <button
                    onClick={handleAddToCart}
                    className="w-full min-w-0 max-w-full whitespace-normal break-words rounded-lg bg-primary-600 px-4 py-2.5 font-semibold text-white transition-colors hover:bg-primary-700 sm:w-auto sm:whitespace-nowrap sm:px-6"
                  >
                    {t('menu.addToCart')} — {currencyFormatter.format(calculateTotal())}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
