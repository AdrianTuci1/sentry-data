import React, { useMemo, useState } from 'react';
import { ArrowUpDown, Check, CircleMinus, Clock3, MoreHorizontal } from 'lucide-react';

export function SalesTransactionsWidget({ data }) {
  const { transactions = [] } = data;
  const [sortKey, setSortKey] = useState('totalRevenue');
  const [sortDirection, setSortDirection] = useState('desc');

  const columns = [
    { key: 'id', label: 'ID', sortable: true },
    { key: 'customer', label: 'Customer', sortable: true },
    { key: 'product', label: 'Product', sortable: true },
    { key: 'status', label: 'Status', sortable: true },
    { key: 'qty', label: 'Qty', sortable: true },
    { key: 'unitPrice', label: 'Unit Price', sortable: true },
    { key: 'totalRevenue', label: 'Total Revenue', sortable: true },
    { key: 'actions', label: 'Actions', sortable: false },
  ];

  const statusConfig = {
    success: { className: 'success', icon: Check, label: 'Success' },
    pending: { className: 'pending', icon: Clock3, label: 'Pending' },
    refunded: { className: 'refunded', icon: CircleMinus, label: 'Refunded' },
  };

  const normalizeValue = (transaction, key) => {
    if (key === 'qty') return transaction.qty;
    if (key === 'unitPrice' || key === 'totalRevenue') {
      return Number(String(transaction[key]).replace(/[$,]/g, ''));
    }
    if (key === 'id') {
      return Number(String(transaction.id).replace(/\D/g, ''));
    }
    return String(transaction[key] || '').toLowerCase();
  };

  const sortedTransactions = useMemo(() => {
    const list = [...transactions];
    list.sort((a, b) => {
      const aValue = normalizeValue(a, sortKey);
      const bValue = normalizeValue(b, sortKey);
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [transactions, sortKey, sortDirection]);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDirection('asc');
  };

  return (
    <div className="sales-transactions-widget">
      <div className="sales-transactions-table">
        <div className="sales-transactions-row sales-transactions-header-row">
          <div className="sales-transactions-checkbox" />
          {columns.map((column) => (
            column.sortable ? (
              <button
                key={column.key}
                type="button"
                className={`sales-transactions-header-cell sales-transactions-header-button ${sortKey === column.key ? 'is-active' : ''}`}
                onClick={() => handleSort(column.key)}
              >
                <span>{column.label}</span>
                <ArrowUpDown size={14} className={sortDirection === 'desc' && sortKey === column.key ? 'is-desc' : ''} />
              </button>
            ) : (
              <div key={column.key} className="sales-transactions-header-cell align-right">
                <span>{column.label}</span>
              </div>
            )
          ))}
        </div>

        {sortedTransactions.map((tx, i) => {
          const status = statusConfig[tx.status.toLowerCase()] || statusConfig.success;
          const Icon = status.icon;

          return (
            <div key={i} className="sales-transactions-row">
              <div className="sales-transactions-checkbox" />
              <div className="sales-transactions-id">
                {tx.id}
              </div>
              <div className="sales-transactions-customer">
                {tx.customer}
              </div>
              <div className="sales-transactions-product">
                {tx.product}
              </div>
              <div className="sales-transactions-status-cell">
                <span className={`sales-transactions-status-pill ${status.className}`}>
                  <Icon size={14} />
                  {status.label}
                </span>
              </div>
              <div className="sales-transactions-qty">
                {tx.qty}
              </div>
              <div className="sales-transactions-price">
                {tx.unitPrice}
              </div>
              <div className="sales-transactions-total">
                {tx.totalRevenue}
              </div>
              <div className="sales-transactions-actions">
                <button className="sales-transactions-menu" type="button" aria-label={`Actions for ${tx.id}`}>
                  <MoreHorizontal size={20} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
