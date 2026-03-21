import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Check, MapPin, Store, Package, Truck, User } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { db } from '../config/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

interface OrderItem {
  name: string;
  quantity?: number;
  price: number;
  image?: string;
}

interface OrderData {
  id?: string;
  storeName?: string;
  storeAddress?: string;
  items?: OrderItem[];
  subtotal?: number;
  deliveryFee?: number;
  total?: number;
  status?: string;
  driverStatus?: string;
  driverId?: string | null;
  destinationAddress?: string;
  stops?: Array<{ address: string; items?: OrderItem[] }>;
  type?: string;
}

type OrderStatus = 'pending' | 'accepted' | 'preparing' | 'ready_for_pickup' | 'driver_assigned';

const statusSteps: { key: OrderStatus | 'searching'; label: string; icon: React.ElementType }[] = [
  { key: 'pending', label: 'Waiting for store to accept', icon: Store },
  { key: 'accepted', label: 'Order Accepted', icon: Check },
  { key: 'preparing', label: 'Preparing Items', icon: Package },
  { key: 'ready_for_pickup', label: 'Ready for Pickup', icon: Package },
  { key: 'searching', label: 'Assigning driver...', icon: Truck },
  { key: 'driver_assigned', label: 'Driver Assigned', icon: User },
];

const getStatusIndex = (status: string, driverStatus?: string): number => {
  if (status === 'driver_assigned' || (status === 'ready_for_pickup' && driverStatus === 'assigned')) {
    return 5;
  }
  if (driverStatus === 'searching') {
    return 4;
  }
  const statusMap: Record<string, number> = {
    pending: 0,
    accepted: 1,
    preparing: 2,
    ready_for_pickup: 3,
  };
  return statusMap[status] ?? 0;
};

export const OrderTrackingPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { orderId, orderData: initialOrderData } = location.state || {};

  const [orderData, setOrderData] = useState<OrderData>(initialOrderData || {});
  const [currentStatusIndex, setCurrentStatusIndex] = useState(0);

  // Listen to Firestore order document in real-time
  useEffect(() => {
    if (!orderId) return;

    const orderRef = doc(db, 'orders', orderId);
    const unsubscribe = onSnapshot(orderRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as OrderData;
        setOrderData({ ...data, id: orderId });

        const newStatusIndex = getStatusIndex(data.status || 'pending', data.driverStatus);
        setCurrentStatusIndex(newStatusIndex);

        // Auto transition to LiveTrackingPage when driver is assigned
        if (data.status === 'driver_assigned' || data.driverId) {
          setTimeout(() => {
            navigate('/live-tracking', {
              state: {
                orderId,
                orderData: { ...data, id: orderId },
              },
              replace: true,
            });
          }, 2500);
        }
      }
    });

    return () => unsubscribe();
  }, [orderId, navigate]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0 },
  };

  return (
    <div className="h-screen w-full bg-gray-50 flex flex-col overflow-hidden">
      {/* FIXED TOP PANEL - Store info */}
      <motion.div
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="flex-shrink-0 bg-white shadow-md px-4 py-4 z-20"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">{orderData.storeName || 'Store'}</h1>
            <p className="text-xs text-gray-500">#{orderId?.slice(-4).toUpperCase() || 'Order'}</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold text-gray-900">
              R {orderData.total?.toFixed(2) || '0.00'}
            </p>
          </div>
        </div>
      </motion.div>

      {/* STATIC STATUS TIMELINE - Center of screen, no scroll */}
      <div className="flex-1 flex items-center justify-center px-4 py-2 overflow-hidden">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl shadow-lg p-4 w-full max-w-md"
        >
          <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-0">
            {statusSteps.map((step, index) => {
              const isCompleted = index < currentStatusIndex;
              const isCurrent = index === currentStatusIndex;
              const Icon = step.icon;

              return (
                <motion.div key={step.key} variants={itemVariants} className="relative">
                  <div className="flex items-start">
                    {/* Timeline Line */}
                    {index < statusSteps.length - 1 && (
                      <div
                        className={`absolute left-[15px] top-[28px] w-0.5 h-8 transition-colors duration-500 ${
                          isCompleted ? 'bg-green-500' : 'bg-gray-200'
                        }`}
                      />
                    )}

                    {/* Icon Circle */}
                    <motion.div
                      animate={isCurrent ? { scale: [1, 1.1, 1] } : {}}
                      transition={isCurrent ? { repeat: Infinity, duration: 1.5 } : {}}
                      className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-500 ${
                        isCompleted
                          ? 'bg-green-500 text-white'
                          : isCurrent
                          ? 'bg-green-500 text-white ring-4 ring-green-100'
                          : 'bg-gray-200 text-gray-400'
                      }`}
                    >
                      {isCompleted ? <Check size={16} /> : <Icon size={16} />}
                    </motion.div>

                    {/* Label */}
                    <div className="ml-3 pb-6">
                      <p
                        className={`text-sm font-medium transition-colors duration-300 ${
                          isCompleted || isCurrent ? 'text-gray-900' : 'text-gray-400'
                        } ${isCurrent ? 'font-bold' : ''}`}
                      >
                        {step.label}
                      </p>
                      {isCurrent && step.key === 'searching' && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="flex items-center mt-1"
                        >
                          <div className="flex space-x-1">
                            {[0, 1, 2].map((i) => (
                              <motion.div
                                key={i}
                                animate={{ scale: [1, 1.3, 1] }}
                                transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.2 }}
                                className="w-1.5 h-1.5 bg-green-500 rounded-full"
                              />
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </motion.div>
      </div>

      {/* FIXED BOTTOM PANELS */}
      <div className="flex-shrink-0 bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-10">
        {/* Order Summary Panel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="px-4 pt-4 pb-2 border-b border-gray-100"
        >
          <h2 className="font-bold text-gray-900 text-sm mb-2">Order Summary</h2>
          
          {/* Scrollable items list - only this scrolls */}
          <div className="max-h-32 overflow-y-auto">
            {orderData.items && orderData.items.length > 0 ? (
              <div className="space-y-2">
                {orderData.items.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between py-1"
                  >
                    <div className="flex items-center space-x-2">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-10 h-10 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                          <Package size={16} className="text-gray-400" />
                        </div>
                      )}
                      <p className="text-sm text-gray-900">{item.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">x{item.quantity || 1}</p>
                      <p className="text-sm font-medium text-gray-900">R {(item.price * (item.quantity || 1)).toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm text-center py-2">No items in order</p>
            )}
          </div>

          {/* Totals - always visible */}
          <div className="mt-2 pt-2 border-t border-gray-100 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-gray-600">Subtotal</span>
              <span className="text-gray-900">R {orderData.subtotal?.toFixed(2) || '0.00'}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-600">Delivery Fee</span>
              <span className="text-gray-900">R {orderData.deliveryFee?.toFixed(2) || '0.00'}</span>
            </div>
            <div className="flex justify-between font-bold text-sm pt-1 border-t border-gray-100">
              <span className="text-gray-900">Total</span>
              <span className="text-gray-900">R {orderData.total?.toFixed(2) || '0.00'}</span>
            </div>
          </div>
        </motion.div>

        {/* Delivery Address Panel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="px-4 py-3"
        >
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
              <MapPin size={16} className="text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 text-sm">Delivery to</p>
              <p className="text-gray-600 text-xs truncate">{orderData.destinationAddress || 'Address not specified'}</p>
            </div>
          </div>

          {/* Multiple Stops */}
          {orderData.stops && orderData.stops.length > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-100">
              <p className="font-medium text-gray-900 text-xs mb-2">Delivery Stops</p>
              {orderData.stops.map((stop, index) => (
                <div key={index} className="flex items-start space-x-2 mb-1 last:mb-0">
                  <div className="w-5 h-5 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-[10px] font-bold text-orange-600">{index + 1}</span>
                  </div>
                  <p className="text-xs text-gray-600 truncate">{typeof stop === 'string' ? stop : stop.address}</p>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};
