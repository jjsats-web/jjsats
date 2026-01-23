"use client";

import { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/format";

export type LineItem = {
  id: string;
  description: string;
  qty: number;
  price: number;
  locked?: boolean;
};

type LineItemsTableProps = {
  items: LineItem[];
  onChangeItem: <K extends keyof LineItem>(
    id: string,
    field: K,
    value: LineItem[K],
  ) => void;
  onRemoveItem: (id: string) => void;
};

export default function LineItemsTable({
  items,
  onChangeItem,
  onRemoveItem,
}: LineItemsTableProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 720px)");
    const update = (event?: MediaQueryListEvent) => {
      setIsMobile(event ? event.matches : media.matches);
    };
    update();
    if ("addEventListener" in media) {
      media.addEventListener("change", update);
      return () => media.removeEventListener("change", update);
    }
    const legacyMedia = media as MediaQueryList & {
      addListener?: (listener: (event: MediaQueryListEvent) => void) => void;
      removeListener?: (listener: (event: MediaQueryListEvent) => void) => void;
    };
    legacyMedia.addListener?.(update);
    return () => legacyMedia.removeListener?.(update);
  }, []);

  if (isMobile) {
    return (
      <div className="line-items-mobile">
        {items.map((item) => {
          const lineTotal = Math.max(item.qty * item.price, 0);
          const isLocked = Boolean(item.locked);
          return (
            <div key={item.id} className="line-item-card">
              <div>
                <label className="line-item-card__label">รายละเอียด</label>
                <input
                  value={item.description}
                  readOnly={isLocked}
                  aria-readonly={isLocked}
                  onChange={(e) =>
                    onChangeItem(item.id, "description", e.target.value)
                  }
                  placeholder="รายละเอียดงานหรือสินค้า"
                />
              </div>
              <div className="line-item-card__grid">
                <div>
                  <label className="line-item-card__label">จำนวน</label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={item.qty}
                    onChange={(e) =>
                      onChangeItem(item.id, "qty", Number(e.target.value) || 0)
                    }
                  />
                </div>
                <div>
                  <label className="line-item-card__label">ราคา/หน่วย</label>
                  <input
                    type="number"
                    min={0}
                    step={100}
                    value={item.price}
                    readOnly={isLocked}
                    aria-readonly={isLocked}
                    onChange={(e) =>
                      onChangeItem(
                        item.id,
                        "price",
                        Number(e.target.value) || 0,
                      )
                    }
                  />
                </div>
              </div>
              <div className="line-item-card__total">
                <span>รวม</span>
                <span>{formatCurrency(lineTotal)}</span>
              </div>
              <button
                type="button"
                className="remove line-item-card__button"
                onClick={() => onRemoveItem(item.id)}
                aria-label="ลบรายการ"
              >
                ลบ
              </button>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <table id="itemsTable">
      <thead>
        <tr>
          <th>รายละเอียด</th>
          <th>จำนวน</th>
          <th>ราคา/หน่วย</th>
          <th>รวม</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => {
          const lineTotal = Math.max(item.qty * item.price, 0);
          const isLocked = Boolean(item.locked);
          return (
            <tr key={item.id}>
              <td>
                <input
                  value={item.description}
                  readOnly={isLocked}
                  aria-readonly={isLocked}
                  onChange={(e) =>
                    onChangeItem(item.id, "description", e.target.value)
                  }
                  placeholder="รายละเอียดงานหรือสินค้า"
                />
              </td>
              <td>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={item.qty}
                  onChange={(e) =>
                    onChangeItem(item.id, "qty", Number(e.target.value) || 0)
                  }
                />
              </td>
              <td>
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={item.price}
                  readOnly={isLocked}
                  aria-readonly={isLocked}
                  onChange={(e) =>
                    onChangeItem(
                      item.id,
                      "price",
                      Number(e.target.value) || 0,
                    )
                  }
                />
              </td>
              <td>{formatCurrency(lineTotal)}</td>
              <td>
                <button
                  type="button"
                  className="remove"
                  onClick={() => onRemoveItem(item.id)}
                  aria-label="ลบรายการ"
                >
                  ลบ
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
