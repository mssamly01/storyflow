import React from 'react';
import { Trash2, ShieldCheck } from 'lucide-react';

interface ConfirmModalProps {
  show: boolean;
  title: string;
  message: string;
  type: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({ show, title, message, type, onConfirm, onCancel }) => {
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-[32px] shadow-2xl max-w-sm w-full p-8 border border-slate-100 animate-in zoom-in duration-300">
        <div className="text-center">
          <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 ${type === 'danger' ? 'bg-rose-50 text-rose-500' : 'bg-indigo-50 text-indigo-500'}`}>
            {type === 'danger' ? <Trash2 className="w-10 h-10" /> : <ShieldCheck className="w-10 h-10" />}
          </div>
          <h3 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">{title}</h3>
          <p className="text-slate-500 text-sm leading-relaxed mb-8 px-2 font-medium">
            {message}
          </p>
          <div className="flex gap-3">
            <button 
              onClick={onCancel}
              className="flex-1 py-4 px-6 rounded-2xl bg-slate-50 text-slate-500 font-black text-[11px] uppercase tracking-widest hover:bg-slate-100 transition-all border border-slate-100"
            >
              Hủy bỏ
            </button>
            <button 
              onClick={onConfirm}
              className={`flex-1 py-4 px-6 rounded-2xl text-white font-black text-[11px] uppercase tracking-widest shadow-lg transition-all active:scale-95 ${type === 'danger' ? 'bg-rose-500 shadow-rose-200 hover:bg-rose-600' : 'bg-indigo-600 shadow-indigo-200 hover:bg-indigo-700'}`}
            >
              Xác nhận
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
