import {
  Activity, ArrowLeftRight,
  Banknote,
  BrainCircuit,
  Calculator,
  Clock,
  Cloud,
  CreditCard,
  Fingerprint,
  HeartPulse,
  Keyboard,
  Lock,
  LogOut,
  MessageCircle,
  Minus,
  Pill,
  Plus,
  Printer as PrinterIcon,
  ScanLine,
  Search,
  ShieldAlert,
  Star,
  Trash2,
  Trophy,
  Truck,
  User,
  UserCheck,
  Wallet,
  X
} from 'lucide-react';
import { useEffect, useState } from 'react';

// --- Enterprise DB Mocks with AI, Clinical, & HR Extensions ---
const CATALOG = [
  { id: 1, name: 'أوميز 20 ملجم (كبسول)', price: 45.00, cost: 31.50, stock: 120, reorderLevel: 20, stripsPerBox: 3, expiry: '05/2027', activeIng: 'Omeprazole', category: 'مضاد حموضة', location: 'رف A-12', commissionRate: 0.01, counseling: 'يُفضل تناوله قبل الإفطار بـ 30 دقيقة للحصول على أفضل نتيجة.', crossSell: [], alternatives: [{ name: 'جازك 20 ملجم', price: 42 }], alert: null },
  { id: 2, name: 'بندول إكسترا', price: 30.00, cost: 24.00, stock: 45, reorderLevel: 50, stripsPerBox: 2, expiry: '11/2025', activeIng: 'Paracetamol + Caffeine', category: 'مسكن ألم', location: 'OTC-01', commissionRate: 0, counseling: 'لا تتجاوز 8 أقراص في اليوم. يحتوي على كافيين، قد يسبب الأرق.', crossSell: [5], alternatives: [{ name: 'أدول إكسترا', price: 25 }], alert: 'تأكد من عدم تعاطي المريض لأدوية برد أخرى تحتوي على باراسيتامول.' },
  { id: 3, name: 'كونكور 5 ملجم', price: 65.00, cost: 48.00, stock: 15, reorderLevel: 20, stripsPerBox: 3, expiry: '02/2026', activeIng: 'Bisoprolol', category: 'ضغط و قلب', location: 'ثلاجة B', commissionRate: 0, counseling: 'لا تتوقف عن تناول الدواء فجأة دون استشارة الطبيب لتجنب تسارع ضربات القلب.', crossSell: [], alternatives: [{ name: 'بيسوكارد 5 ملجم', price: 55 }], alert: null },
  { id: 4, name: 'أوجمنتين 1جم', price: 130.00, cost: 98.50, stock: 8, reorderLevel: 10, stripsPerBox: 2, expiry: '08/2026', activeIng: 'Amoxicillin + Clavulanate', category: 'مضاد حيوي', location: 'رف C-05', commissionRate: 0.03, counseling: 'يُفضل تناوله في بداية الوجبة لتقليل اضطرابات المعدة. يجب إكمال الجرعة كاملة.', crossSell: [5], alternatives: [{ name: 'هاي بويتك 1جم', price: 95 }], alert: null },
  { id: 5, name: 'فيتامين سي 1000 + زنك', price: 45.00, cost: 20.00, stock: 200, reorderLevel: 50, stripsPerBox: 2, expiry: '01/2028', activeIng: 'Vitamin C + Zinc', category: 'مكمل غذائي', location: 'OTC-04', commissionRate: 0.10, counseling: 'يُذاب القرص الفوار في نصف كوب ماء. يرفع المناعة بشكل فعال.', crossSell: [], alternatives: [], alert: null },
];

const CUSTOMERS_DB = [
  { phone: '01012345678', name: 'مهندس خالد', points: 1250, creditBalance: -450, churnRisk: false, lateRefills: [] },
  { phone: '01198765432', name: 'أستاذة منى (مريضة ضغط)', points: 300, creditBalance: 0, churnRisk: true, lateRefills: [{ item: 'كونكور 5 ملجم', daysLate: 6 }] }, // Churn Risk Example
];

const RIDERS_DB = [
  { id: 'R1', name: 'كابتن محمود' },
  { id: 'R2', name: 'كابتن سيد' }
];

export default function App() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(new Date());

  const [shift, setShift] = useState({ isOpen: false, id: null, startTime: null, openingCash: 0, earnedCommission: 0 });
  const [showShiftModal, setShowShiftModal] = useState(true);
  const [openingCashInput, setOpeningCashInput] = useState('');
  const [isOwnerMode, setIsOwnerMode] = useState(false);

  const [cart, setCart] = useState([]);
  const [heldCarts, setHeldCarts] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [customerPhone, setCustomerPhone] = useState('');
  const [activeCustomer, setActiveCustomer] = useState(null);

  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [tenderedAmount, setTenderedAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');

  // Omnichannel Delivery State
  const [isDeliveryOrder, setIsDeliveryOrder] = useState(false);
  const [selectedRider, setSelectedRider] = useState(RIDERS_DB[0].id);
  const deliveryFee = isDeliveryOrder ? 15.00 : 0;

  const [insuranceCoPay, setInsuranceCoPay] = useState(20);
  const [insuranceApprovalId, setInsuranceApprovalId] = useState('');

  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [managerPin, setManagerPin] = useState('');

  const [receiptData, setReceiptData] = useState(null);
  const dailyTarget = 15000;

  useEffect(() => { const timer = setInterval(() => setCurrentTime(new Date()), 1000); return () => clearInterval(timer); }, []);

  useEffect(() => {
    if (!shift.isOpen) return;
    const syncInterval = setInterval(() => {
      setIsCloudSyncing(true);
      setTimeout(() => { setIsCloudSyncing(false); setLastSync(new Date()); }, 1500);
    }, 30000);
    return () => clearInterval(syncInterval);
  }, [shift.isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' && e.key !== 'Enter' && e.key !== 'Escape') return;
      if (e.key === 'Enter' && cart.length > 0 && !isCheckoutOpen && !showOverrideModal && shift.isOpen) setIsCheckoutOpen(true);
      if (e.key === 'Escape') { setIsCheckoutOpen(false); setShowOverrideModal(false); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, isCheckoutOpen, showOverrideModal, shift.isOpen]);

  useEffect(() => {
    if (customerPhone.length >= 10) {
      const found = CUSTOMERS_DB.find(c => c.phone === customerPhone);
      setActiveCustomer(found || { phone: customerPhone, name: 'عميل جديد', points: 0, creditBalance: 0, churnRisk: false, lateRefills: [] });
    } else { setActiveCustomer(null); }
  }, [customerPhone]);

  // --- Actions ---
  const handleOpenShift = () => {
    setShift({ isOpen: true, id: `SHF-${Math.floor(Math.random() * 10000)}`, startTime: new Date(), openingCash: parseFloat(openingCashInput) || 0, earnedCommission: 0 });
    setShowShiftModal(false);
  };

  const addToCart = (item) => {
    if (!shift.isOpen) { alert('يجب فتح وردية أولاً'); return; }
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) return prev.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { ...item, qty: 1 }];
    });
    setSelectedItem(item);
  };

  // AI Cross-Sell Handler
  const handleAddCrossSell = (crossSellId) => {
    const item = CATALOG.find(i => i.id === crossSellId);
    if (item) addToCart(item);
  };

  const requestManagerOverride = (action) => { setPendingAction(() => action); setShowOverrideModal(true); };
  const executeManagerOverride = () => {
    if (managerPin === '1234') {
      if (pendingAction) pendingAction();
      setShowOverrideModal(false); setManagerPin(''); setPendingAction(null);
    } else if (managerPin === '9999') {
      setIsOwnerMode(!isOwnerMode); setShowOverrideModal(false); setManagerPin('');
    } else { alert('رمز الدخول غير صحيح'); }
  };
  const removeFromCartProtected = (id) => requestManagerOverride(() => setCart(prev => prev.filter(i => i.id !== id)));
  const updateQty = (id, delta) => setCart(prev => prev.map(i => i.id === id ? { ...i, qty: Math.max(0.01, i.qty + delta) } : i));

  // --- Financial & HR Commission Engine ---
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const totalCost = cart.reduce((sum, item) => sum + (item.cost * item.qty), 0);
  const currentCartCommission = cart.reduce((sum, item) => sum + (item.price * item.qty * (item.commissionRate || 0)), 0);
  const grossProfit = subtotal - totalCost;
  const grossMarginPercent = subtotal > 0 ? ((grossProfit / subtotal) * 100).toFixed(1) : 0;

  let total = subtotal + deliveryFee;
  let insuranceCoverage = 0;

  if (paymentMethod === 'insurance') {
    const coPayFactor = Math.max(0, Math.min(100, insuranceCoPay)) / 100;
    total = (subtotal * coPayFactor) + deliveryFee;
    insuranceCoverage = subtotal - (subtotal * coPayFactor);
  }

  const change = tenderedAmount ? Math.max(0, parseFloat(tenderedAmount || 0) - total) : 0;

  const handleCompleteAndPrint = () => {
    if (paymentMethod === 'insurance' && !insuranceApprovalId) { alert("برجاء إدخال رقم موافقة التأمين"); return; }

    // تحديث عمولة الكاشير المتراكمة
    setShift(prev => ({ ...prev, earnedCommission: prev.earnedCommission + currentCartCommission }));

    const currentReceipt = {
      date: new Date().toLocaleString('ar-EG'), shiftId: shift.id, items: [...cart],
      subtotal, deliveryFee, total, insuranceCoverage,
      tendered: parseFloat(tenderedAmount || 0) || total, change, paymentMethod, insuranceApprovalId,
      customer: activeCustomer, isDeliveryOrder, rider: isDeliveryOrder ? RIDERS_DB.find(r => r.id === selectedRider)?.name : null,
      invoiceNumber: Math.floor(100000 + Math.random() * 900000)
    };
    setReceiptData(currentReceipt);

    setTimeout(() => {
      window.print();
      setCart([]); setIsCheckoutOpen(false); setTenderedAmount(''); setIsDeliveryOrder(false);
      setCustomerPhone(''); setActiveCustomer(null); setSelectedItem(null);
    }, 300);
  };

  const handleSendWhatsApp = () => {
    if (!activeCustomer?.phone) { alert("برجاء تسجيل هاتف العميل أولاً لإرسال الفاتورة."); return; }
    // محاكاة إرسال الفاتورة عبر الواتساب
    handleCompleteAndPrint();
    alert(`تم إرسال الفاتورة الإلكترونية بنجاح إلى رقم: ${activeCustomer.phone} عبر WhatsApp.`);
  };

  // --- Modals ---
  const ShiftModal = () => {
    if (!showShiftModal) return null;
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#050e17]/95 backdrop-blur-xl p-4 print:hidden">
        <div className="bg-[#0c1f30] border border-[#00c7f2]/40 shadow-[0_0_80px_rgba(0,199,242,0.15)] rounded-3xl w-full max-w-md p-8 animate-in zoom-in">
          <div className="flex flex-col items-center text-center mb-8">
            <div className="bg-[#00c7f2]/10 p-5 rounded-full mb-4 border border-[#00c7f2]/20"><LogOut className="w-10 h-10 text-[#00c7f2]" /></div>
            <h2 className="text-3xl font-bold text-white mb-2">تسجيل الدخول للوردية</h2>
          </div>
          <div className="space-y-4 mb-8">
            <div>
              <label className="block text-sm text-[#b8c0cc] mb-2 font-medium">العهدة النقدية الافتتاحية (Opening Float)</label>
              <div className="relative">
                <Banknote className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 text-[#8597a8]" />
                <input autoFocus type="number" value={openingCashInput} onChange={(e) => setOpeningCashInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleOpenShift()} className="w-full bg-[#050e17] border-2 border-[#102a43] text-2xl text-[#e8ecf2] rounded-xl py-4 pr-12 pl-4 focus:border-[#00c7f2] font-mono" placeholder="مثال: 1000" />
              </div>
            </div>
          </div>
          <button onClick={handleOpenShift} className="w-full bg-gradient-to-r from-[#00c7f2] to-[#20bce5] text-[#050e17] py-4 rounded-xl font-bold text-xl hover:shadow-[0_0_20px_rgba(0,199,242,0.4)] transition-all">فتح الوردية</button>
        </div>
      </div>
    );
  };

  const ManagerOverrideModal = () => {
    if (!showOverrideModal) return null;
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#050e17]/90 backdrop-blur-md p-4 print:hidden">
        <div className="bg-[#081826] border border-[#ffab3d]/50 shadow-[0_0_50px_rgba(255,171,61,0.2)] rounded-2xl w-full max-w-sm flex flex-col p-6 animate-in zoom-in-95">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="bg-[#ffab3d]/20 p-4 rounded-full mb-4"><Lock className="w-8 h-8 text-[#ffab3d]" /></div>
            <h2 className="text-xl font-bold text-[#e8ecf2]">تصريح إداري مطلوب</h2>
            <p className="text-sm text-[#8597a8] mt-2">إلغاء الصنف (PIN: 1234) | مالك (PIN: 9999)</p>
          </div>
          <input autoFocus type="password" value={managerPin} onChange={(e) => setManagerPin(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && executeManagerOverride()} className="w-full bg-[#050e17] border border-[#102a43] text-center text-2xl text-[#e8ecf2] tracking-widest rounded-xl py-3 mb-4 focus:outline-none focus:border-[#ffab3d]" placeholder="****" />
          <div className="flex gap-3">
            <button onClick={() => setShowOverrideModal(false)} className="flex-1 bg-[#102a43] text-[#b8c0cc] py-3 rounded-xl font-bold">إلغاء</button>
            <button onClick={executeManagerOverride} className="flex-1 bg-[#ffab3d] text-[#050e17] py-3 rounded-xl font-bold">تأكيد</button>
          </div>
        </div>
      </div>
    );
  };

  const CheckoutModal = () => {
    if (!isCheckoutOpen) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050e17]/85 backdrop-blur-md p-4 print:hidden transition-all">
        <div className="bg-gradient-to-br from-[#0c1f30] to-[#081826] border border-[#00c7f2]/40 shadow-[0_0_100px_rgba(0,199,242,0.25)] rounded-3xl w-full max-w-4xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
          <div className="p-5 bg-gradient-to-r from-[#050e17] to-[#0c1f30] border-b border-[#102a43] flex justify-between items-center">
            <h2 className="text-2xl font-bold flex items-center gap-3 text-[#e8ecf2]"><Fingerprint className="w-6 h-6 text-[#00c7f2]" /> إتمام المعاملة المالية (Checkout)</h2>
            <button onClick={() => setIsCheckoutOpen(false)} className="text-[#8597a8] hover:text-[#ff7b7b] bg-[#102a43]/50 p-2 rounded-xl transition-colors"><X className="w-6 h-6" /></button>
          </div>

          <div className="p-8 flex flex-col md:flex-row gap-8">
            <div className="flex-1 space-y-6">
              <div className="text-center p-8 bg-gradient-to-b from-[#102a43]/40 to-[#050e17]/80 rounded-2xl border border-[#102a43] relative overflow-hidden shadow-inner">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#00c7f2] via-[#7467f8] to-[#1dd48b]"></div>
                <p className="text-[#8597a8] mb-2 text-base font-medium">إجمالي المستحق للتحصيل (ج.م)</p>
                <p className="text-7xl font-serif text-[#5cdfff] drop-shadow-[0_0_15px_rgba(0,199,242,0.4)]">{total.toFixed(2)}</p>
                {isDeliveryOrder && <p className="text-[#ffab3d] text-sm mt-3 font-bold bg-[#ffab3d]/10 py-1.5 rounded-lg border border-[#ffab3d]/20">شامل مصاريف التوصيل: {deliveryFee} ج</p>}
                {paymentMethod === 'insurance' && <p className="text-[#1dd48b] text-base mt-3 font-bold bg-[#1dd48b]/10 py-1.5 rounded-lg border border-[#1dd48b]/20">تغطية التأمين: {insuranceCoverage.toFixed(2)} ج</p>}
              </div>

              {/* Delivery Toggle (Omnichannel Module) */}
              <div className="bg-[#050e17] p-4 rounded-xl border border-[#102a43]">
                <label className="flex items-center gap-2 cursor-pointer text-[#e8ecf2] font-bold">
                  <input type="checkbox" checked={isDeliveryOrder} onChange={(e) => setIsDeliveryOrder(e.target.checked)} className="w-5 h-5 accent-[#00c7f2] bg-[#102a43] border-[#102a43] rounded" />
                  <Truck className="w-5 h-5 text-[#ffab3d]" /> توجيه كأمر توصيل دليفري (Delivery)
                </label>
                {isDeliveryOrder && (
                  <div className="mt-4 animate-in slide-in-from-top-2">
                    <label className="block text-xs text-[#8597a8] mb-1.5">تعيين الطيار (Rider Dispatch):</label>
                    <select value={selectedRider} onChange={(e) => setSelectedRider(e.target.value)} className="w-full bg-[#0c1f30] border border-[#102a43] text-[#e8ecf2] rounded-lg py-2.5 px-3 focus:outline-none focus:border-[#ffab3d] font-bold">
                      {RIDERS_DB.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
            </div>

            <div className="flex-[1.2] flex flex-col gap-6 border-t md:border-t-0 md:border-r border-[#102a43] pt-6 md:pt-0 md:pr-8">
              <div>
                <p className="text-base text-[#b8c0cc] mb-3 font-medium">اختر طريقة الدفع</p>
                <div className="grid grid-cols-4 gap-3">
                  <button onClick={() => setPaymentMethod('cash')} className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${paymentMethod === 'cash' ? 'bg-[#00c7f2]/10 border-[#00c7f2] text-[#00c7f2]' : 'bg-[#050e17] border-[#102a43] text-[#8597a8]'}`}><Banknote className="w-6 h-6 mb-1" /><span className="text-xs font-bold">نقدي</span></button>
                  <button onClick={() => setPaymentMethod('visa')} className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${paymentMethod === 'visa' ? 'bg-[#7467f8]/10 border-[#7467f8] text-[#7467f8]' : 'bg-[#050e17] border-[#102a43] text-[#8597a8]'}`}><CreditCard className="w-6 h-6 mb-1" /><span className="text-xs font-bold">بطاقة</span></button>
                  <button onClick={() => setPaymentMethod('insurance')} className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${paymentMethod === 'insurance' ? 'bg-[#1dd48b]/10 border-[#1dd48b] text-[#1dd48b]' : 'bg-[#050e17] border-[#102a43] text-[#8597a8]'}`}><ShieldAlert className="w-6 h-6 mb-1" /><span className="text-xs font-bold">تأمين</span></button>
                  <button onClick={() => setPaymentMethod('credit')} className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${paymentMethod === 'credit' ? 'bg-[#ffab3d]/10 border-[#ffab3d] text-[#ffab3d]' : 'bg-[#050e17] border-[#102a43] text-[#8597a8]'}`}><Wallet className="w-6 h-6 mb-1" /><span className="text-xs font-bold">آجل</span></button>
                </div>
              </div>

              {paymentMethod === 'insurance' && (
                <div className="animate-in slide-in-from-top-4 p-4 bg-[#1dd48b]/10 border border-[#1dd48b]/30 rounded-2xl space-y-3">
                  <div><label className="block text-xs text-[#1dd48b] mb-1 font-bold">نسبة تحمل المريض (Co-pay %)</label><input type="number" value={insuranceCoPay} onChange={(e) => setInsuranceCoPay(e.target.value)} className="w-full bg-[#050e17] border border-[#102a43] text-[#e8ecf2] rounded-xl py-2 px-3 focus:border-[#1dd48b] font-mono" /></div>
                  <div><label className="block text-xs text-[#1dd48b] mb-1 font-bold">رقم موافقة التأمين (Approval ID)</label><input type="text" value={insuranceApprovalId} onChange={(e) => setInsuranceApprovalId(e.target.value)} className="w-full bg-[#050e17] border border-[#1dd48b]/50 text-[#e8ecf2] rounded-xl py-2 px-3 focus:border-[#1dd48b] font-mono" /></div>
                </div>
              )}

              {paymentMethod === 'cash' && (
                <div className="animate-in slide-in-from-top-4">
                  <label className="block text-xs text-[#b8c0cc] mb-1.5 font-medium">المبلغ المستلم</label>
                  <div className="relative">
                    <Calculator className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8597a8]" />
                    <input type="number" value={tenderedAmount} onChange={(e) => setTenderedAmount(e.target.value)} autoFocus className="w-full bg-[#050e17] border-2 border-[#102a43] text-3xl text-[#e8ecf2] rounded-2xl py-3 pr-14 pl-4 focus:border-[#00c7f2] font-mono" placeholder={total.toFixed(2)} />
                  </div>
                  <div className="flex justify-between items-center mt-3 p-4 rounded-xl bg-gradient-to-r from-[#050e17] to-[#0c1f30] border border-[#102a43]">
                    <span className="text-[#b8c0cc] text-sm font-medium">الباقي (Change):</span>
                    <span className={`text-2xl font-mono font-bold ${change > 0 ? 'text-[#1dd48b]' : 'text-[#8597a8]'}`}>{change.toFixed(2)}</span>
                  </div>
                </div>
              )}

              <div className="mt-auto grid grid-cols-3 gap-3">
                <button onClick={handleSendWhatsApp} className="col-span-1 bg-[#25D366] hover:bg-[#128C7E] text-white font-bold py-4 rounded-xl transition-all shadow-[0_0_20px_rgba(37,211,102,0.3)] flex flex-col justify-center items-center gap-1 transform hover:-translate-y-1">
                  <MessageCircle className="w-6 h-6" /> <span className="text-xs">إرسال WhatsApp</span>
                </button>
                <button onClick={handleCompleteAndPrint} className="col-span-2 relative overflow-hidden bg-gradient-to-r from-[#00c7f2] to-[#20bce5] text-[#050e17] font-bold text-lg py-4 rounded-xl hover:shadow-[0_0_30px_rgba(0,199,242,0.4)] transition-all flex justify-center items-center gap-2 transform hover:-translate-y-1 group">
                  <div className="absolute inset-0 w-1/4 h-full bg-white/30 skew-x-12 group-hover:animate-[dpScan_1s_ease-in-out_infinite]"></div>
                  <PrinterIcon className="w-6 h-6 relative z-10" /> <span className="relative z-10">{isDeliveryOrder ? 'طباعة أمر توصيل' : 'طباعة وإتمام البيع'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const ThermalReceipt = () => {
    if (!receiptData) return null;
    return (
      <div className="hidden print:block text-black bg-white w-full max-w-[80mm] mx-auto p-4 font-mono text-sm leading-tight text-right dir-rtl">
        <style>{`@media print { @page { margin: 0; size: 80mm 297mm; } body { background: white; margin: 0; } .print-hidden { display: none !important; } }`}</style>
        <div className="text-center mb-3">
          <h1 className="text-xl font-bold font-serif mb-1">DataPulse ERP</h1>
          <p className="text-xs">صيدلية داتابلس - {receiptData.location}</p>
          <div className="border-b border-dashed border-black my-2"></div>
        </div>
        <div className="text-xs mb-3 space-y-1">
          <p className="font-bold text-center text-lg">{receiptData.isDeliveryOrder ? 'أمر توصيل دليفري 🛵' : receiptData.paymentMethod === 'insurance' ? 'فاتورة تأمين طبي' : 'فاتورة ضريبية مبسطة'}</p>
          {receiptData.isDeliveryOrder && <p className="font-bold border border-black p-1 text-center mt-1">الطيار: {receiptData.rider}</p>}
          <p>وردية: {receiptData.shiftId} | كاشير: د. أحمد</p>
          <p>رقم الفاتورة: #{receiptData.invoiceNumber}</p>
          <p>التاريخ: {receiptData.date}</p>
        </div>
        <div className="border-b border-dashed border-black my-2"></div>
        <table className="w-full text-xs text-right mb-2">
          <thead><tr className="border-b border-black"><th className="py-1 w-1/2">الصنف</th><th className="py-1 text-center">كمية</th><th className="py-1 text-left">قيمة</th></tr></thead>
          <tbody>
            {receiptData.items.map(item => (
              <tr key={item.id} className="border-b border-gray-300">
                <td className="py-1">{item.name}</td>
                <td className="py-1 text-center">{item.qty}</td>
                <td className="py-1 text-left">{(item.price * item.qty).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-b border-dashed border-black my-2"></div>
        <div className="text-sm space-y-1">
          <div className="flex justify-between"><p>الإجمالي الفرعي:</p><p>{receiptData.subtotal.toFixed(2)}</p></div>
          {receiptData.isDeliveryOrder && <div className="flex justify-between font-bold"><p>رسوم التوصيل:</p><p>+{receiptData.deliveryFee.toFixed(2)}</p></div>}
          {receiptData.paymentMethod === 'insurance' && <div className="flex justify-between"><p>تغطية التأمين:</p><p>-{receiptData.insuranceCoverage.toFixed(2)}</p></div>}
          <div className="flex justify-between font-bold text-base mt-2 pt-1 border-t border-black"><p>إجمالي المستحق:</p><p>{receiptData.total.toFixed(2)}</p></div>
        </div>
        <div className="border-b border-dashed border-black my-3"></div>
        <div className="text-center text-xs">
          {receiptData.customer && receiptData.customer.name !== 'عميل جديد' && (
            <div className="mb-2 border border-black p-2 text-right">
              <p className="font-bold">العميل: {receiptData.customer.name}</p>
              <p>هاتف: {receiptData.customer.phone}</p>
            </div>
          )}
          <p className="font-bold">نتمنى لكم الشفاء العاجل</p>
        </div>
      </div>
    );
  };

  return (
    <>
      <ShiftModal />
      <div dir="rtl" className="print:hidden h-screen w-full bg-[#050e17] text-[#e8ecf2] font-sans flex flex-col overflow-hidden relative">
        <header className="flex flex-col bg-[#081826] border-b border-[#102a43] z-20">
          <div className="flex items-center justify-between px-4 py-1.5 bg-[#050e17] text-[10px] border-b border-[#102a43]/50">
            <div className="flex items-center gap-5">
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-[#1dd48b]/30 bg-[#1dd48b]/10 text-[#1dd48b]">
                <Cloud className="w-3 h-3" /><span className="font-bold tracking-wider">متصل بالخادم السحابي</span>
              </div>
              <span className="text-[#5a6b7c] font-mono hidden md:inline">آخر مزامنة: {lastSync.toLocaleTimeString('ar-EG')}</span>
            </div>
            {/* HR Engine: Live Commission Tracker */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-[#d4af37]/10 px-3 py-0.5 rounded border border-[#d4af37]/30">
                <Star className="w-3.5 h-3.5 text-[#d4af37] animate-pulse" />
                <span className="text-[#d4af37] font-bold">العمولة المكتسبة (حافز): {shift.earnedCommission.toFixed(2)} ج.م</span>
              </div>
              <div className="hidden lg:flex items-center gap-3 w-48">
                <Trophy className="w-3.5 h-3.5 text-[#d4af37]" />
                <div className="flex-1 bg-[#102a43] h-1.5 rounded-full overflow-hidden">
                  <div className="bg-gradient-to-r from-[#d4af37] to-[#ffab3d] h-full transition-all" style={{ width: `${Math.min(100, (subtotal / dailyTarget) * 100)}%` }}></div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between px-5 py-2.5">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-br from-[#00c7f2]/20 to-transparent p-2 rounded-xl border border-[#00c7f2]/30"><Activity className="w-6 h-6 text-[#00c7f2]" /></div>
                <div className="flex flex-col"><span className="font-black tracking-wide text-xl text-white leading-none mb-1">DataPulse <span className="font-light text-[#00c7f2]">Omni</span></span><span className="text-[10px] text-[#1dd48b] font-bold tracking-widest uppercase">AI & Delivery Edition</span></div>
              </div>
            </div>

            <div className="flex items-center gap-5">
              <div className="hidden lg:flex items-center gap-2 bg-[#050e17] px-4 py-2 rounded-xl border border-[#102a43] shadow-inner">
                <Clock className="w-5 h-5 text-[#8597a8]" />
                <span className="font-mono text-[#e8ecf2] tracking-wider text-base font-bold">{currentTime.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
              </div>
              <button onClick={() => requestManagerOverride()} className="flex items-center gap-2 bg-[#102a43]/40 hover:bg-[#102a43] px-4 py-2 rounded-xl border border-[#102a43] transition-all group">
                <div className="bg-[#050e17] p-1.5 rounded-lg"><User className="w-4 h-4 text-[#00c7f2]" /></div>
                <div className="flex flex-col items-start"><span className="text-xs font-bold text-[#e8ecf2] leading-none mb-1">د. أحمد مجدي</span><span className="text-[10px] text-[#1dd48b] font-mono">{isOwnerMode ? 'المدير المالك (Owner)' : 'كاشير - T01'}</span></div>
              </button>
            </div>
          </div>
        </header>

        <main className={`flex-1 flex flex-col lg:flex-row gap-4 p-4 overflow-hidden relative z-0 transition-opacity duration-500 ${!shift.isOpen ? 'opacity-20 pointer-events-none blur-sm' : ''}`}>

          <section className="flex-[4] flex flex-col bg-[#0c1f30]/40 rounded-3xl border border-[#102a43] overflow-hidden shadow-xl">
            {/* Predictive Churn CRM */}
            <div className="p-4 border-b border-[#102a43] bg-gradient-to-r from-[#081826] to-[#0c1f30] flex flex-col gap-3">
              <div className="relative group">
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8597a8] group-focus-within:text-[#7467f8] transition-colors" />
                <input type="text" placeholder="رقم هاتف العميل (للتوصيل أو الآجل)..." className="w-full bg-[#050e17] border border-[#102a43] text-[#e8ecf2] rounded-xl py-3 pr-12 pl-4 text-sm focus:outline-none focus:border-[#7467f8] transition-all font-mono" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
              </div>
              {activeCustomer && (
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center bg-[#102a43]/50 p-3 rounded-xl border border-[#102a43]">
                    <div className="flex items-center gap-3"><div className="bg-[#7467f8]/20 p-2 rounded-lg"><UserCheck className="w-5 h-5 text-[#7467f8]" /></div><div><p className="text-sm font-bold text-white">{activeCustomer.name}</p><p className="text-[10px] text-[#8597a8]">نقاط الولاء: {activeCustomer.points}</p></div></div>
                    <div className="text-left"><p className="text-[10px] text-[#8597a8] mb-0.5">حالة الحساب الآجل</p><p className={`font-mono text-sm font-bold ${activeCustomer.creditBalance < 0 ? 'text-[#ff7b7b]' : 'text-[#1dd48b]'}`}>{activeCustomer.creditBalance < 0 ? `مدين بـ ${Math.abs(activeCustomer.creditBalance)} ج` : 'رصيد سليم'}</p></div>
                  </div>
                  {/* AI Churn Prediction Alert */}
                  {activeCustomer.churnRisk && (
                    <div className="bg-[#ff7b7b]/10 border border-[#ff7b7b]/30 p-2.5 rounded-lg flex items-start gap-2 animate-in slide-in-from-top-1">
                      <BrainCircuit className="w-5 h-5 text-[#ff7b7b] shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-[#ff7b7b] mb-1">تحذير استباقي: عميل معرض للتسرب (Churn Risk)</p>
                        <p className="text-[11px] text-[#e8ecf2]">العميل متأخر عن موعد إعادة الصرف لـ: <span className="font-bold">{activeCustomer.lateRefills[0]?.item}</span> ({activeCustomer.lateRefills[0]?.daysLate} أيام تأخير). اسأل المريض عن صحته!</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-4 border-b border-[#102a43] bg-[#0c1f30]/60 relative">
              <ScanLine className="absolute right-6 top-1/2 -translate-y-1/2 w-6 h-6 text-[#00c7f2]" />
              <input type="text" placeholder="مسح الباركود [ / ]" className="w-full bg-[#050e17] border-2 border-[#102a43] text-[#e8ecf2] rounded-2xl py-3.5 pr-14 pl-4 focus:outline-none focus:border-[#00c7f2] font-bold text-lg shadow-inner" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-[#050e17]/30">
              {cart.map((item) => (
                <div key={item.id} onClick={() => setSelectedItem(item)} className={`flex items-center justify-between p-3.5 rounded-2xl border-2 transition-all ${selectedItem?.id === item.id ? 'bg-[#102a43]/80 border-[#00c7f2]/50 shadow-md' : 'bg-[#050e17] border-[#102a43]'}`}>
                  <div className="flex items-center gap-4 w-full">
                    <button onClick={(e) => { e.stopPropagation(); removeFromCartProtected(item.id); }} className="p-2 text-[#5a6b7c] hover:text-[#ff7b7b] bg-[#102a43]/30 rounded-xl group relative"><Trash2 className="w-5 h-5 group-hover:opacity-0 transition-opacity" /><Lock className="w-5 h-5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[#ffab3d] opacity-0 group-hover:opacity-100 transition-opacity" /></button>
                    <div className="flex flex-col bg-[#081826] rounded-xl border border-[#102a43] overflow-hidden w-28 shrink-0">
                      <div className="flex items-center justify-between bg-[#102a43]/40 border-b border-[#102a43] py-1 px-2"><button onClick={(e) => { e.stopPropagation(); updateQty(item.id, -1); }} className="text-[#b8c0cc] hover:text-white"><Minus className="w-3.5 h-3.5" /></button><span className="font-mono text-[#00c7f2] font-black text-base">{item.qty}</span><button onClick={(e) => { e.stopPropagation(); updateQty(item.id, 1); }} className="text-[#b8c0cc] hover:text-white"><Plus className="w-3.5 h-3.5" /></button></div>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-[#e8ecf2] text-sm md:text-base mb-1">{item.name}</h4>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-[#8597a8] font-mono bg-[#102a43]/50 px-2 py-0.5 rounded">{item.price.toFixed(2)} ج</span>
                        {item.commissionRate > 0 && <span className="text-[9px] text-[#d4af37] border border-[#d4af37]/30 px-1 rounded flex items-center"><Star className="w-2 h-2 mr-0.5" /> صنف حافز</span>}
                      </div>
                    </div>
                    <div className="font-mono text-xl text-white font-black min-w-[80px] text-left">{(item.price * item.qty).toFixed(2)}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-gradient-to-t from-[#081826] to-[#0c1f30] border-t border-[#102a43] p-5 z-10">
              <div className="flex justify-between items-end mb-4">
                <span className="text-xl text-[#b8c0cc] font-bold">إجمالي السلة:</span>
                <span className="text-5xl font-serif text-[#5cdfff] tracking-tighter drop-shadow-md">{subtotal.toFixed(2)} <span className="text-2xl text-[#00c7f2] font-sans">ج.م</span></span>
              </div>
              <button disabled={cart.length === 0} onClick={() => setIsCheckoutOpen(true)} className={`w-full font-bold text-xl py-4 rounded-xl flex items-center justify-center gap-2 transition-all ${cart.length === 0 ? 'bg-[#102a43] text-[#5a6b7c]' : 'bg-[#00c7f2] hover:bg-[#5cdfff] text-[#050e17] shadow-[0_0_20px_rgba(0,199,242,0.3)] hover:scale-[1.02]'}`}>بدء الدفع وتوجيه الطلب <Keyboard className="w-5 h-5 opacity-50 ml-2" /></button>
            </div>
          </section>

          <section className="flex-[3] flex flex-col gap-4">
            <div className="flex-1 flex flex-col bg-[#0c1f30]/40 rounded-3xl border border-[#102a43] overflow-hidden">
              <div className="p-4 border-b border-[#102a43] bg-[#081826]"><h3 className="font-bold text-[#e8ecf2] flex items-center gap-2"><Pill className="w-5 h-5 text-[#00c7f2]" /> الأصناف السريعة</h3></div>
              <div className="flex-1 p-4 overflow-y-auto bg-[#050e17]/30">
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                  {CATALOG.map((item) => (
                    <button key={item.id} onClick={() => addToCart(item)} className="h-28 rounded-2xl p-3 text-right flex flex-col justify-between bg-gradient-to-b from-[#163452] to-[#0c1f30] border border-[#102a43] border-b-[5px] border-b-[#050e17] hover:brightness-110 active:translate-y-1 transition-all">
                      <div className="flex justify-between items-start">
                        <span className="text-[12px] font-mono font-bold text-[#1dd48b] bg-[#050e17] px-2 py-1 rounded shadow-inner">{item.price} ج</span>
                        {item.commissionRate > 0 && <Star className="w-3.5 h-3.5 text-[#d4af37]" />}
                      </div>
                      <span className="text-sm font-bold text-[#e8ecf2] leading-tight line-clamp-2">{item.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Clinical Intel & AI Cross-Sell Panel */}
          <section className="flex-[2.5] flex flex-col bg-[#0c1f30]/40 rounded-3xl border border-[#102a43] overflow-hidden">
            <div className="p-4 border-b border-[#102a43] bg-[#081826] flex justify-between items-center">
              <h3 className="font-bold text-[#e8ecf2] flex items-center gap-2"><HeartPulse className="w-5 h-5 text-[#00c7f2]" /> التثقيف والدعم السريري</h3>
            </div>

            {selectedItem ? (
              <div className="flex-1 overflow-y-auto flex flex-col">
                <div className="p-5 bg-gradient-to-b from-[#163452]/20 to-transparent border-b border-[#102a43]/50">
                  <h2 className="text-2xl font-bold text-white mb-4 leading-tight">{selectedItem.name}</h2>

                  {/* Flash Patient Counseling */}
                  {selectedItem.counseling && (
                    <div className="mb-4 bg-[#00c7f2]/10 border border-[#00c7f2]/30 p-3 rounded-xl flex items-start gap-3">
                      <MessageCircle className="w-5 h-5 text-[#00c7f2] shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[10px] font-bold text-[#00c7f2] mb-1">نصيحة سريعة للمريض (Counseling Tip)</p>
                        <p className="text-xs text-[#e8ecf2] font-medium leading-relaxed">{selectedItem.counseling}</p>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 mb-2">
                    <div className="bg-[#050e17] p-3 rounded-xl border border-[#102a43]">
                      <p className="text-xs text-[#8597a8] mb-1 font-medium">الرصيد الحي</p>
                      <p className={`font-mono text-2xl font-black ${selectedItem.stock <= selectedItem.reorderLevel ? 'text-[#ff7b7b]' : 'text-[#1dd48b]'}`}>{selectedItem.stock}</p>
                    </div>
                    <div className="bg-[#050e17] p-3 rounded-xl border border-[#102a43]">
                      <p className="text-xs text-[#8597a8] mb-1 font-medium">أقرب انتهاء</p>
                      <p className="font-mono text-xl font-bold text-[#e8ecf2]">{selectedItem.expiry}</p>
                    </div>
                  </div>
                </div>

                {/* AI Cross-Sell Suggestions */}
                {selectedItem.crossSell?.length > 0 && (
                  <div className="p-5 border-b border-[#102a43]/50">
                    <h4 className="font-bold flex items-center gap-2 text-[#d4af37] text-sm mb-3">
                      <BrainCircuit className="w-4 h-4" /> توصيات البيع المتقاطع (AI Cross-sell)
                    </h4>
                    <div className="space-y-2">
                      {selectedItem.crossSell.map(csId => {
                        const csItem = CATALOG.find(i => i.id === csId);
                        if (!csItem) return null;
                        return (
                          <div key={csId} className="flex justify-between items-center bg-gradient-to-r from-[#d4af37]/10 to-transparent border border-[#d4af37]/30 p-3 rounded-xl">
                            <span className="font-bold text-[#e8ecf2] text-sm">{csItem.name}</span>
                            <button onClick={() => handleAddCrossSell(csId)} className="bg-[#d4af37] text-[#050e17] px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-white transition-colors">إضافة +</button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                <div className="p-5 flex-1">
                  <h4 className="font-bold flex items-center gap-2 text-[#e8ecf2] text-sm mb-3"><ArrowLeftRight className="w-4 h-4 text-[#00c7f2]" /> البدائل المتاحة</h4>
                  <div className="space-y-3">
                    {selectedItem.alternatives.map((alt, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-[#081826] border border-[#102a43] p-3 rounded-xl">
                        <span className="font-bold text-[#e8ecf2] text-sm">{alt.name}</span>
                        <div className="bg-[#050e17] px-3 py-1.5 rounded-lg text-sm font-mono text-[#00c7f2] font-bold border border-[#102a43]">{alt.price.toFixed(2)} ج</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-[#5a6b7c] p-6 text-center opacity-60">
                <HeartPulse className="w-16 h-16 mb-4 opacity-50" />
                <p className="font-bold text-lg">اللوحة السريرية والذكاء الاصطناعي</p>
                <p className="text-xs mt-2 max-w-[200px] leading-relaxed">حدد دواء لعرض نصائح التثقيف وتوصيات المبيعات الذكية.</p>
              </div>
            )}
          </section>
        </main>

        <CheckoutModal />
        <ManagerOverrideModal />
      </div>
    </>
  );
}