import { motion, AnimatePresence } from "framer-motion";
import { Check, RotateCcw, Plus } from "lucide-react";

/**
 * pending: null | { id, message?, customerName? }
 * onUndo: () => void
 * onNewOrder: (() => void) | null  — hides button if null
 */
export default function PickupToast({ pending, onUndo, onNewOrder }) {
  return (
    <AnimatePresence>
      {pending && (
        <motion.div
          key="pickup-toast"
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", stiffness: 300, damping: 32 }}
          className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl shadow-2xl overflow-hidden"
        >
          {/* Countdown progress bar */}
          <div className="relative h-1.5 bg-stone-100 w-full">
            <motion.div
              key={pending.id}
              className="absolute inset-0 bg-emerald-400"
              style={{ transformOrigin: "left" }}
              initial={{ scaleX: 1 }}
              animate={{ scaleX: 0 }}
              transition={{ duration: 3, ease: "linear" }}
            />
          </div>

          {/* Content */}
          <div className="px-5 pt-4 pb-8">
            <div className="flex items-center gap-2 mb-0.5">
              <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              <span className="font-bold text-stone-900">
                {pending.message ?? "Marcat com a recollit"}
              </span>
            </div>
            {pending.customerName
              ? <p className="text-sm text-stone-500 mb-4 ml-6">{pending.customerName}</p>
              : <div className="mb-4" />
            }
            <div className="flex gap-2">
              <button
                onClick={onUndo}
                className="flex-1 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-sm flex items-center justify-center gap-1.5 transition-colors active:scale-95"
              >
                <RotateCcw className="w-4 h-4" /> Desfer
              </button>
              {onNewOrder && (
                <button
                  onClick={onNewOrder}
                  className="flex-1 py-2.5 rounded-xl text-stone-900 font-semibold text-sm flex items-center justify-center gap-1.5 transition-colors active:scale-95"
                  style={{ backgroundColor: "#F59E0B" }}
                >
                  <Plus className="w-4 h-4" /> Nova comanda
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
