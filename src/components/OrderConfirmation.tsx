import { CheckCircle2, Mail, Clock, RotateCcw } from 'lucide-react';
import { formatPriceEur } from '../config/orderConfig';
import type { OrderConfirmationResult } from '../services/orderService';

interface OrderConfirmationProps {
  confirmation: OrderConfirmationResult;
  onStartNewOrder: () => void;
}

export function OrderConfirmation({
  confirmation,
  onStartNewOrder,
}: OrderConfirmationProps) {
  return (
    <div
      className="max-w-2xl mx-auto rounded-2xl border border-zinc-200 bg-[#FBFBF9] p-6 sm:p-10 space-y-8"
      role="status"
      aria-live="polite"
    >
      <div className="space-y-4">
        <div className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-800">
          <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" aria-hidden="true" />
          <span>Ordine confermato · {confirmation.orderId}</span>
        </div>

        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-900 text-balance">
          Stiamo preparando il tuo libro da colorare
        </h2>

        <p className="text-base text-zinc-600 leading-relaxed">
          Abbiamo ricevuto il pagamento e le tue{' '}
          <span className="font-semibold text-zinc-900 font-mono-num">
            {confirmation.photoCount}
          </span>{' '}
          foto. Il libro personalizzato in formato PDF sarà inviato direttamente alla tua email.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-medium text-zinc-500">
            <Clock className="w-4 h-4 text-[#B83B1F]" aria-hidden="true" />
            <span>Tempi stimati di consegna</span>
          </div>
          <p className="text-base font-semibold text-zinc-900">
            Entro {confirmation.estimatedDelivery}
          </p>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-4 space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-medium text-zinc-500">
            <Mail className="w-4 h-4 text-[#B83B1F]" aria-hidden="true" />
            <span>Controlla la tua posta</span>
          </div>
          <p className="text-sm font-semibold text-zinc-900 break-all">
            {confirmation.email}
          </p>
        </div>
      </div>

      <div className="rounded-xl bg-white border border-zinc-200 p-5 space-y-3 text-sm">
        <h3 className="font-semibold text-zinc-900">Riepilogo dell’ordine</h3>
        <dl className="divide-y divide-zinc-100">
          <div className="py-2 flex items-center justify-between gap-4">
            <dt className="text-zinc-600">Mondo scelto</dt>
            <dd className="font-medium text-zinc-900">{confirmation.themeName}</dd>
          </div>
          <div className="py-2 flex items-center justify-between gap-4">
            <dt className="text-zinc-600">Titolo in copertina</dt>
            <dd className="font-medium text-zinc-900 text-right">{confirmation.coverTitle}</dd>
          </div>
          <div className="py-2 flex items-center justify-between gap-4">
            <dt className="text-zinc-600">Pagine illustrate</dt>
            <dd className="font-medium text-zinc-900 font-mono-num">
              {confirmation.photoCount} foto + copertina
            </dd>
          </div>
          <div className="pt-3 flex items-center justify-between gap-4">
            <dt className="font-semibold text-zinc-900">Totale pagato</dt>
            <dd className="font-semibold text-zinc-900 font-mono-num">
              {formatPriceEur(confirmation.totalEur)}
            </dd>
          </div>
        </dl>
      </div>

      <div className="text-sm text-zinc-600 leading-relaxed space-y-2 border-t border-zinc-200 pt-5">
        <p>
          Se non vedi l’email dopo {confirmation.estimatedDelivery}, controlla le cartelle{' '}
          <strong className="font-medium text-zinc-900">Spam</strong> o{' '}
          <strong className="font-medium text-zinc-900">Promozioni</strong>.
        </p>
        <p>
          Le foto originali caricate verranno cancellate automaticamente subito dopo la generazione del PDF.
        </p>
      </div>

      <div>
        <button
          type="button"
          onClick={onStartNewOrder}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-zinc-700 bg-white border border-zinc-300 rounded-xl hover:bg-zinc-50 hover:text-zinc-900 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B83B1F]"
        >
          <RotateCcw className="w-4 h-4" aria-hidden="true" />
          Crea un altro libro
        </button>
      </div>
    </div>
  );
}
