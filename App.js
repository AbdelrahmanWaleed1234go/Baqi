import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
  Modal,
  FlatList,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, {
  Path,
  Rect,
  Circle,
  Line,
} from "react-native-svg";
import { requireOptionalNativeModule } from "expo";
import { CURRENCIES } from "./currencies";

// فحص وجود الحزمة الأصلية بدون التسبب بأي خطأ أو إيقاف في Expo Go
let SpeechModule = null;
try {
  if (requireOptionalNativeModule && requireOptionalNativeModule("ExpoSpeechRecognition")) {
    SpeechModule = require("expo-speech-recognition")?.ExpoSpeechRecognitionModule || null;
  }
} catch (e) {
  SpeechModule = null;
}

// مفاتيح تخزين البيانات
const STORAGE_KEYS = {
  SALARY: "@baqi_salary",
  EXPENSES: "@baqi_expenses",
  INSTALLMENTS: "@baqi_installments",
  CURRENCY: "@baqi_currency",
  DARK_MODE: "@baqi_dark_mode",
  LANGUAGE: "@baqi_language",
};

// ================= 🧠 دالة التعرف والتحليل الذكي للنص العربي للمصروف =================
function parseArabicExpense(text) {
  if (!text) return { title: "", amount: "" };
  const eastern = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
  let normalized = text;
  eastern.forEach((num, i) => {
    normalized = normalized.split(num).join(i.toString());
  });

  const wordsToNum = {
    خمسمية: 500,
    خمسمائة: 500,
    ميتين: 200,
    مئتان: 200,
    مائة: 100,
    مية: 100,
    ميه: 100,
    تسعين: 90,
    تمانين: 80,
    ثمانين: 80,
    سبعين: 70,
    ستين: 60,
    خمسين: 50,
    اربعين: 40,
    أربعين: 40,
    تلاتين: 30,
    ثلاثين: 30,
    عشرين: 20,
    عشرة: 10,
    عشر: 10,
    ألف: 1000,
    الف: 1000,
  };

  for (const [w, n] of Object.entries(wordsToNum)) {
    const r = new RegExp("(^|[\\s،,])" + w + "([\\s،,]|$)", "g");
    normalized = normalized.replace(r, " " + n + " ");
  }

  const match = normalized.match(/(\d+(\.\d+)?)/);
  if (match) {
    const amount = match[1];
    let title = normalized.replace(match[0], "");
    const stripWords = ["بقيمة", "بمبلغ", "بـ", "ب", "جنيه", "ريال", "درهم", "دولار"];
    stripWords.forEach((sw) => {
      const r = new RegExp("(^|[\\s،,])" + sw + "([\\s،,]|$)", "g");
      title = title.replace(r, " ");
    });
    title = title.replace(/[،,:\-]/g, " ").replace(/\s+/g, " ").trim();
    return { title: title || "مصروف صوتي", amount };
  }
  return { title: text.trim(), amount: "" };
}

// ================= 🎨 أيقونات SVG دقيقة =================

// شعار باقي (المعين الهندسي المزدوج)
const DiamondLogo = ({ size = 22, color = "#bfa15f" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect
      x="12"
      y="2.5"
      width="13.4"
      height="13.4"
      transform="rotate(45 12 2.5)"
      stroke={color}
      strokeWidth="2.2"
      strokeLinejoin="round"
    />
    <Rect
      x="12"
      y="7.6"
      width="6.2"
      height="6.2"
      transform="rotate(45 12 7.6)"
      fill={color}
    />
  </Svg>
);

// الأقواس الزخرفية المائية للكرت الرئيسي
const HeroArchWatermark = ({ isDarkMode }) => (
  <View style={svgStyles.watermarkContainer} pointerEvents="none">
    <Svg width={110} height={120} viewBox="0 0 110 120" fill="none">
      <Path
        d="M 12 120 V 38 A 28 28 0 0 1 68 38 V 120"
        stroke={isDarkMode ? "#34d399" : "#059669"}
        strokeWidth="1.8"
        strokeOpacity={isDarkMode ? "0.18" : "0.15"}
      />
      <Path
        d="M 24 120 V 44 A 16 16 0 0 1 56 44 V 120"
        stroke={isDarkMode ? "#34d399" : "#059669"}
        strokeWidth="1.8"
        strokeOpacity={isDarkMode ? "0.18" : "0.15"}
      />
      <Path
        d="M 36 120 V 50 A 4 4 0 0 1 44 50 V 120"
        stroke={isDarkMode ? "#34d399" : "#059669"}
        strokeWidth="1.8"
        strokeOpacity={isDarkMode ? "0.18" : "0.15"}
      />
    </Svg>
  </View>
);

// أيقونة الرئيسية
const HomeIcon = ({ color, size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1V9.5z" />
  </Svg>
);

// أيقونة البطاقة / الأقساط
const CardIcon = ({ color, size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Rect x="2" y="5" width="20" height="14" rx="2.5" />
    <Line x1="2" y1="10" x2="22" y2="10" />
  </Svg>
);

// أيقونة الإعدادات (السلايدرز)
const SettingsIcon = ({ color, size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Line x1="4" y1="7" x2="20" y2="7" />
    <Circle cx="8" cy="7" r="2.8" stroke={color} strokeWidth="2" />
    <Line x1="4" y1="17" x2="20" y2="17" />
    <Circle cx="16" cy="17" r="2.8" stroke={color} strokeWidth="2" />
  </Svg>
);

// أيقونة الميكروفون
const MicIcon = ({ color = "#052419", size = 22 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
    <Path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <Line x1="12" y1="19" x2="12" y2="22" />
  </Svg>
);

// أيقونة الإضافة (+)
const PlusIcon = ({ color = "#052419", size = 22 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <Line x1="12" y1="5" x2="12" y2="19" />
    <Line x1="5" y1="12" x2="19" y2="12" />
  </Svg>
);

// أيقونة النقود في الإعدادات
const CashIcon = ({ color, size = 22 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <Rect x="2" y="6" width="20" height="12" rx="2" />
    <Circle cx="12" cy="12" r="3" />
    <Line x1="6" y1="12" x2="6.01" y2="12" strokeWidth="2.5" />
    <Line x1="18" y1="12" x2="18.01" y2="12" strokeWidth="2.5" />
  </Svg>
);

// أيقونة القمر (الوضع الداكن)
const MoonIcon = ({ color, size = 22 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </Svg>
);

// أيقونة الترجمة واللغة
const LanguageIcon = ({ color, size = 22 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M4 5h7M7 2v3M4 11c1.5-1 3.5-3 4-6M9 9c-.5 2-2 4-5 5" />
    <Path d="M19 21l-4-9-4 9M13 18h6" />
  </Svg>
);

// أيقونة المستند / السجل
const ReceiptIcon = ({ color = "#bfa15f", size = 22 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <Path d="M14 2v6h6" />
    <Line x1="16" y1="13" x2="8" y2="13" />
    <Line x1="16" y1="17" x2="8" y2="17" />
    <Line x1="10" y1="9" x2="8" y2="9" />
  </Svg>
);

// أيقونة المعلومات (i)
const InfoIcon = ({ color = "#6b7280", size = 16 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="12" cy="12" r="10" />
    <Line x1="12" y1="16" x2="12" y2="12" />
    <Line x1="12" y1="8" x2="12.01" y2="8" strokeWidth="2.5" />
  </Svg>
);

// الرسم الدائري للمصاريف (Donut Chart)
const DonutChart = ({ totalOutflow, expensesTotal, installmentsTotal, currencySymbol, isDarkMode }) => {
  const size = 110;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const total = totalOutflow > 0 ? totalOutflow : 1;
  const expRatio = totalOutflow > 0 ? expensesTotal / total : 0;
  const instRatio = totalOutflow > 0 ? installmentsTotal / total : 0;

  const expDash = expRatio * circumference;
  const instDash = instRatio * circumference;

  return (
    <View style={{ width: size, height: size, justifyContent: "center", alignItems: "center" }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={isDarkMode ? "#162a34" : "#e5e7eb"}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {totalOutflow > 0 && expDash > 0 && (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#34d399"
            strokeWidth={strokeWidth}
            strokeDasharray={`${expDash} ${circumference - expDash}`}
            strokeDashoffset={circumference / 4}
            strokeLinecap="round"
            fill="none"
          />
        )}
        {totalOutflow > 0 && instDash > 0 && (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#818cf8"
            strokeWidth={strokeWidth}
            strokeDasharray={`${instDash} ${circumference - instDash}`}
            strokeDashoffset={circumference / 4 - expDash}
            strokeLinecap="round"
            fill="none"
          />
        )}
      </Svg>
      <View style={{ position: "absolute", alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: isDarkMode ? "#ffffff" : "#111827", fontSize: 13, fontWeight: "bold" }}>
          {totalOutflow.toLocaleString()} {currencySymbol}
        </Text>
        <Text style={{ color: isDarkMode ? "#94a3b8" : "#6b7280", fontSize: 10, marginTop: 2 }}>
          المنصرف
        </Text>
      </View>
    </View>
  );
};

export default function App() {
  const [salary, setSalary] = useState("");
  const [expenses, setExpenses] = useState([]);
  const [expenseTitle, setExpenseTitle] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");

  const [installments, setInstallments] = useState([]);
  const [installTitle, setInstallTitle] = useState("");
  const [installAmount, setInstallAmount] = useState("");

  const [selectedCurrency, setSelectedCurrency] = useState(CURRENCIES[0] || {
    code: "SAR",
    name: "ريال سعودي",
    symbol: "ر.س",
    flag: "🇸🇦",
  });
  const [isCurrencyModalVisible, setCurrencyModalVisible] = useState(false);
  const [currencySearch, setCurrencySearch] = useState("");

  const [isAddExpenseModalVisible, setAddExpenseModalVisible] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [language, setLanguage] = useState("ar");
  const [currentScreen, setCurrentScreen] = useState("home"); // home | installments | settings
  const [isLoaded, setIsLoaded] = useState(false);

  // ================= 🎙️ حالة التعرف الصوتي على المصروف =================
  const [isVoiceModalVisible, setVoiceModalVisible] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [voiceTitle, setVoiceTitle] = useState("");
  const [voiceAmount, setVoiceAmount] = useState("");

  // ربط أحداث الصوت بأمان بدون أي كراش في Expo Go
  useEffect(() => {
    if (!SpeechModule) return;
    try {
      const sub1 = SpeechModule.addListener?.("start", () => setIsListening(true));
      const sub2 = SpeechModule.addListener?.("end", () => setIsListening(false));
      const sub3 = SpeechModule.addListener?.("result", (event) => {
        const text = event?.results?.[0]?.transcript || "";
        if (text) {
          setVoiceTranscript(text);
          const parsed = parseArabicExpense(text);
          if (parsed.title) setVoiceTitle(parsed.title);
          if (parsed.amount) setVoiceAmount(parsed.amount);
        }
      });
      const sub4 = SpeechModule.addListener?.("error", (event) => {
        console.warn("Speech error:", event?.error, event?.message);
        setIsListening(false);
      });
      return () => {
        sub1?.remove?.();
        sub2?.remove?.();
        sub3?.remove?.();
        sub4?.remove?.();
      };
    } catch (e) {
      console.warn("Listener error:", e);
    }
  }, []);

  // ================= 🔄 استرجاع البيانات =================
  useEffect(() => {
    loadSavedData();
  }, []);

  const loadSavedData = async () => {
    try {
      const savedSalary = await AsyncStorage.getItem(STORAGE_KEYS.SALARY);
      const savedExpenses = await AsyncStorage.getItem(STORAGE_KEYS.EXPENSES);
      const savedInstallments = await AsyncStorage.getItem(STORAGE_KEYS.INSTALLMENTS);
      const savedCurrency = await AsyncStorage.getItem(STORAGE_KEYS.CURRENCY);
      const savedDarkMode = await AsyncStorage.getItem(STORAGE_KEYS.DARK_MODE);
      const savedLanguage = await AsyncStorage.getItem(STORAGE_KEYS.LANGUAGE);

      if (savedSalary !== null) setSalary(savedSalary);
      if (savedExpenses !== null) setExpenses(JSON.parse(savedExpenses));
      if (savedInstallments !== null) setInstallments(JSON.parse(savedInstallments));
      if (savedCurrency !== null) setSelectedCurrency(JSON.parse(savedCurrency));
      if (savedDarkMode !== null) setIsDarkMode(JSON.parse(savedDarkMode));
      if (savedLanguage !== null) setLanguage(savedLanguage);
    } catch (e) {
      console.error("فشل في استرجاع البيانات:", e);
    } finally {
      setIsLoaded(true);
    }
  };

  // ================= 💾 دالات الحفظ =================
  const saveSalary = async (value) => {
    setSalary(value);
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SALARY, value);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddExpense = async () => {
    if (!expenseTitle.trim() || !expenseAmount.trim()) {
      Alert.alert(
        language === "ar" ? "تنبيه" : "Alert",
        language === "ar"
          ? "يرجى إدخال اسم المصروف والمبلغ"
          : "Please enter title and amount"
      );
      return;
    }
    const newExpenses = [
      { id: Date.now().toString(), title: expenseTitle.trim(), amount: expenseAmount.trim() },
      ...expenses,
    ];
    setExpenses(newExpenses);
    setExpenseTitle("");
    setExpenseAmount("");
    setAddExpenseModalVisible(false);
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(newExpenses));
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteExpense = async (id) => {
    const newExpenses = expenses.filter((item) => item.id !== id);
    setExpenses(newExpenses);
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(newExpenses));
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddInstallment = async () => {
    if (!installTitle.trim() || !installAmount.trim()) {
      Alert.alert(
        language === "ar" ? "تنبيه" : "Alert",
        language === "ar"
          ? "يرجى إدخال اسم القسط والمبلغ الشهري"
          : "Please enter installment title and monthly amount"
      );
      return;
    }
    const newInstallments = [
      { id: Date.now().toString(), title: installTitle.trim(), amount: installAmount.trim() },
      ...installments,
    ];
    setInstallments(newInstallments);
    setInstallTitle("");
    setInstallAmount("");
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.INSTALLMENTS, JSON.stringify(newInstallments));
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteInstallment = async (id) => {
    const newInstallments = installments.filter((item) => item.id !== id);
    setInstallments(newInstallments);
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.INSTALLMENTS, JSON.stringify(newInstallments));
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectCurrency = async (currency) => {
    setSelectedCurrency(currency);
    setCurrencyModalVisible(false);
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.CURRENCY, JSON.stringify(currency));
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleDarkMode = async (val) => {
    setIsDarkMode(val);
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.DARK_MODE, JSON.stringify(val));
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectLanguage = async (lang) => {
    setLanguage(lang);
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.LANGUAGE, lang);
    } catch (e) {
      console.error(e);
    }
  };

  // ================= 🎙️ بدء وإيقاف الاستماع الصوتي =================
  const voiceInputRef = React.useRef(null);
  const hasSpeechNative = !!SpeechModule;

  const startListening = async () => {
    if (hasSpeechNative) {
      try {
        const perms = await SpeechModule.requestPermissionsAsync();
        if (!perms.granted) {
          Alert.alert(
            language === "ar" ? "إذن الميكروفون مطلوب" : "Permission Required",
            language === "ar"
              ? "يرجى منح صلاحية الميكروفون والتعرف على الصوت لإضافة المصاريف صوتياً."
              : "Please enable microphone permission to use voice recognition."
          );
          return;
        }
        setVoiceTranscript("");
        setVoiceTitle("");
        setVoiceAmount("");
        setIsListening(true);
        SpeechModule.start({
          lang: language === "ar" ? "ar-SA" : "en-US",
          interimResults: true,
          continuous: false,
          requiresOnDeviceRecognition: false,
          addsPunctuation: true,
        });
      } catch (err) {
        console.warn("Speech recognition start failed:", err);
        setIsListening(false);
        // fallback: ركز على حقل الإدخال
        Alert.alert(
          language === "ar" ? "تنبيه" : "Notice",
          language === "ar"
            ? "فشل تشغيل التعرف الصوتي. استخدم ميكروفون الكيبورد 🎤 أو اكتب يدوياً."
            : "Speech recognition failed. Use keyboard mic 🎤 or type manually."
        );
        setTimeout(() => voiceInputRef.current?.focus(), 300);
      }
    } else {
      // لا يوجد native module (مثلاً في Expo Go) — ركز على حقل الإدخال
      Alert.alert(
        language === "ar" ? "💡 نصيحة" : "💡 Tip",
        language === "ar"
          ? "التعرف الصوتي المباشر يحتاج Development Build.\n\nدلوقتي ممكن تستخدم ميكروفون الكيبورد 🎤 في شريط الكتابة، أو اكتب مثلاً:\n«غداء 45» أو «بنزين 120»\nوباقي هيفصل الاسم والمبلغ تلقائياً."
          : "Direct voice recognition requires a Development Build.\n\nFor now, use the keyboard mic 🎤 in the text field, or type e.g.:\n\"Lunch 45\" or \"Gas 120\"\nBaqi will auto-split the title and amount."
      );
      setTimeout(() => voiceInputRef.current?.focus(), 300);
    }
  };

  const stopListening = () => {
    if (hasSpeechNative) {
      try {
        SpeechModule.stop();
      } catch (e) {
        console.warn(e);
      }
    }
    setIsListening(false);
  };

  const handleOpenVoiceModal = async () => {
    setVoiceTranscript("");
    setVoiceTitle("");
    setVoiceAmount("");
    setVoiceModalVisible(true);
    if (hasSpeechNative) {
      await startListening();
    } else {
      // في Expo Go: نركز على حقل الإدخال مباشرة
      setTimeout(() => voiceInputRef.current?.focus(), 500);
    }
  };

  const handleConfirmVoiceExpense = async () => {
    if (!voiceTitle.trim() || !voiceAmount.trim()) {
      Alert.alert(
        language === "ar" ? "تنبيه" : "Alert",
        language === "ar"
          ? "يرجى التأكد من اسم المصروف والمبلغ قبل الإضافة"
          : "Please specify title and amount"
      );
      return;
    }
    const newExpenses = [
      { id: Date.now().toString(), title: voiceTitle.trim(), amount: voiceAmount.trim() },
      ...expenses,
    ];
    setExpenses(newExpenses);
    setVoiceTitle("");
    setVoiceAmount("");
    setVoiceTranscript("");
    setVoiceModalVisible(false);
    stopListening();
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(newExpenses));
    } catch (e) {
      console.error(e);
    }
  };

  // ================= 📊 الحسابات =================
  const totalSpent = expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const totalInstallments = installments.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const totalOutflow = totalSpent + totalInstallments;
  const totalIncome = Number(salary) || 0;
  const remaining = totalIncome - totalOutflow;

  const filteredCurrencies = CURRENCIES.filter(
    (item) =>
      item.name.includes(currencySearch) ||
      item.code.toLowerCase().includes(currencySearch.toLowerCase()) ||
      item.symbol.includes(currencySearch)
  );

  // ================= 🎨 ثيم الألوان للوضعين الفاتح والداكن =================
  const theme = {
    bg: isDarkMode ? "#060e12" : "#fbfcfd",
    cardBg: isDarkMode ? "#0d1e26" : "#ffffff",
    heroBg: isDarkMode ? "#0d2d24" : "#e8f5ee",
    heroBorder: isDarkMode ? "#144436" : "#cbe8d6",
    heroText: isDarkMode ? "#ffffff" : "#111827",
    heroLabel: isDarkMode ? "#a7f3d0" : "#065f46",
    heroSubNote: isDarkMode ? "#6ee7b7" : "#059669",
    heroDivider: isDarkMode ? "#174839" : "#cbe8d6",
    text: isDarkMode ? "#ffffff" : "#111827",
    subText: isDarkMode ? "#94a3b8" : "#6b7280",
    border: isDarkMode ? "#172d37" : "#e5e7eb",
    inputBg: isDarkMode ? "#071318" : "#f3f4f6",
    bottomNavBg: isDarkMode ? "#060e12" : "#ffffff",
    navActivePillBg: isDarkMode ? "#092f23" : "#e6f7f0",
    navActiveBorder: isDarkMode ? "#134c38" : "transparent",
    navActiveText: isDarkMode ? "#34d399" : "#047857",
    navInactiveText: isDarkMode ? "#64748b" : "#9ca3af",
    emptyIconContainerBg: isDarkMode ? "#15262f" : "#fbf5ea",
    emptyIconColor: isDarkMode ? "#e2d9b6" : "#bfa15f",
    goldColor: isDarkMode ? "#e2d9b6" : "#bfa15f",
    settingsIconBg: isDarkMode ? "#132832" : "#ecfdf5",
    settingsIconColor: isDarkMode ? "#5eead4" : "#059669",
    langActiveBg: isDarkMode ? "#072c21" : "#e6f7f0",
    langActiveBorder: isDarkMode ? "#10b981" : "#10b981",
    langActiveText: isDarkMode ? "#34d399" : "#047857",
  };

  if (!isLoaded) {
    return (
      <View style={[styles.container, { backgroundColor: theme.bg, justifyContent: "center", alignItems: "center" }]}>
        <DiamondLogo size={42} color={theme.goldColor} />
        <Text style={{ color: "#34d399", fontSize: 18, fontWeight: "bold", marginTop: 16 }}>
          جاري فتح باقي...
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar
        barStyle={isDarkMode ? "light-content" : "dark-content"}
        backgroundColor={theme.bg}
      />

      {/* ================= 💎 الشريط العلوي ================= */}
      <View style={styles.topHeader}>
        <View style={styles.brandRow}>
          <DiamondLogo size={20} color={theme.goldColor} />
          <Text style={[styles.brandTitle, { color: theme.text }]}>باقي</Text>
        </View>

        <Text style={[styles.brandSlogan, { color: theme.subText }]}>
          كل ريال، بحساب.
        </Text>
      </View>

      {/* ================= 📱 المحتوى حسب التبويب ================= */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {currentScreen === "home" ? (
          /* ================= 🏠 الشاشة الرئيسية ================= */
          <>
            <View style={styles.screenHeading}>
              <Text style={[styles.mainScreenTitle, { color: theme.text }]}>
                {language === "ar" ? "الرئيسية" : "Home"}
              </Text>
              <Text style={[styles.mainScreenSubtitle, { color: theme.subText }]}>
                {language === "ar"
                  ? "صورة أوضح لمصاريفك، وراحة أكثر لبالك."
                  : "A clearer view of your spending, and peace of mind."}
              </Text>
            </View>

            {/* 🟢 كرت الهيرو الزمردي الأنيق */}
            <View style={[styles.heroCard, { backgroundColor: theme.heroBg, borderColor: theme.heroBorder }]}>
              <HeroArchWatermark isDarkMode={isDarkMode} />

              <Text style={[styles.heroLabel, { color: theme.heroLabel }]}>
                {language === "ar" ? "إجمالي المنصرف" : "Total Outflow"}
              </Text>

              <View style={styles.heroAmountRow}>
                <Text style={[styles.heroAmountNumber, { color: theme.heroText }]}>
                  {totalOutflow.toLocaleString()}
                </Text>
                <Text style={[styles.heroAmountSymbol, { color: theme.heroSubNote }]}>
                  {" "}{selectedCurrency.symbol}
                </Text>
              </View>

              <Text style={[styles.heroSubNote, { color: theme.heroSubNote }]}>
                {language === "ar" ? "شامل المصاريف والأقساط" : "Includes expenses and installments"}
              </Text>

              <View style={[styles.heroDivider, { backgroundColor: theme.heroDivider }]} />

              <View style={styles.heroStatsRow}>
                <View style={styles.heroStatItem}>
                  <Text style={[styles.heroStatLabel, { color: theme.subText }]}>
                    {language === "ar" ? "الميزانية" : "Budget"}
                  </Text>
                  <Text style={[styles.heroStatValue, { color: theme.heroText }]}>
                    {totalIncome.toLocaleString()} {selectedCurrency.symbol}
                  </Text>
                </View>

                <View style={styles.heroStatItem}>
                  <Text style={[styles.heroStatLabel, { color: theme.subText }]}>
                    {language === "ar" ? "المتبقي" : "Remaining"}
                  </Text>
                  <Text
                    style={[
                      styles.heroStatValue,
                      { color: remaining < 0 ? "#ef4444" : isDarkMode ? "#34d399" : "#059669" },
                    ]}
                  >
                    {remaining.toLocaleString()} {selectedCurrency.symbol}
                  </Text>
                </View>
              </View>
            </View>

            {/* 💳 كارت الميزانية / المرتب */}
            <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
              <Text style={[styles.cardHeading, { color: theme.text }]}>
                {language === "ar" ? "الميزانية / المرتّب" : "Salary / Budget"}
              </Text>
              <View style={[styles.currencyInputContainer, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
                <TextInput
                  style={[styles.currencyInputText, { color: theme.text }]}
                  placeholder={language === "ar" ? "...أدخل مبلغ المرتب" : "Enter salary amount..."}
                  placeholderTextColor={isDarkMode ? "#475569" : "#9ca3af"}
                  keyboardType="numeric"
                  value={salary}
                  onChangeText={saveSalary}
                />
                <Text style={[styles.currencyInputBadge, { color: theme.subText }]}>{selectedCurrency.symbol}</Text>
              </View>
            </View>

            {/* 🟢 الأزرار الدائرية العائمة (الميكروفون + الإضافة) في منتصف الشاشة */}
            <View style={styles.actionButtonsRow}>
              <TouchableOpacity
                style={styles.circleActionButton}
                onPress={handleOpenVoiceModal}
                activeOpacity={0.8}
              >
                <MicIcon color="#052419" size={24} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.circleActionButton}
                onPress={() => setAddExpenseModalVisible(true)}
                activeOpacity={0.8}
              >
                <PlusIcon color="#052419" size={24} />
              </TouchableOpacity>
            </View>

            {/* 📋 سجل المصاريف */}
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                {language === "ar" ? "سجل المصاريف" : "Expenses Log"}
              </Text>
              <View style={[styles.countBadge, { backgroundColor: theme.inputBg }]}>
                <Text style={[styles.countBadgeText, { color: theme.subText }]}>{expenses.length}</Text>
              </View>
            </View>

            {expenses.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                <View style={[styles.emptyIconBox, { backgroundColor: theme.emptyIconContainerBg }]}>
                  <ReceiptIcon color={theme.emptyIconColor} size={24} />
                </View>
                <View style={styles.emptyTextContainer}>
                  <Text style={[styles.emptyTitle, { color: theme.text }]}>
                    {language === "ar" ? "لا توجد مصاريف مسجلة." : "No expenses recorded."}
                  </Text>
                  <Text style={[styles.emptySubtitle, { color: theme.subText }]}>
                    {language === "ar"
                      ? "أضف أول مصروف وابدأ متابعة ميزانيتك."
                      : "Add your first expense to track your budget."}
                  </Text>
                </View>
              </View>
            ) : (
              expenses.map((item) => (
                <View
                  key={item.id}
                  style={[styles.listItemRow, { backgroundColor: theme.cardBg, borderColor: theme.border }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.listItemTitle, { color: theme.text }]}>
                      {item.title}
                    </Text>
                    <Text style={styles.listItemAmountRed}>
                      -{Number(item.amount).toLocaleString()} {selectedCurrency.symbol}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.deleteActionBtn}
                    onPress={() => handleDeleteExpense(item.id)}
                  >
                    <Text style={styles.deleteActionText}>حذف</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}

            {/* 📊 التقارير والإحصائيات البصرية */}
            <View style={{ marginTop: 24 }}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                {language === "ar" ? "التقارير والإحصائيات البصرية" : "Visual Reports & Analytics"}
              </Text>
              <Text style={[styles.sectionSubtitle, { color: theme.subText }]}>
                {language === "ar" ? "لتتبع فين بتروح فلوسك بالضبط" : "Track exactly where your money goes"}
              </Text>

              <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border, marginTop: 12 }]}>
                <View style={styles.reportTopRow}>
                  <View style={[styles.reportStateBadge, { backgroundColor: theme.inputBg }]}>
                    <Text style={[styles.reportStateTag, { color: theme.subText }]}>
                      {totalOutflow === 0 ? "حالة فارغة" : "تحليل النفقات"}
                    </Text>
                  </View>
                  <Text style={[styles.reportHeaderTitle, { color: theme.text }]}>
                    توزيع المصاريف
                  </Text>
                </View>

                <View style={styles.chartAndLegendRow}>
                  <DonutChart
                    totalOutflow={totalOutflow}
                    expensesTotal={totalSpent}
                    installmentsTotal={totalInstallments}
                    currencySymbol={selectedCurrency.symbol}
                    isDarkMode={isDarkMode}
                  />

                  <View style={styles.legendContainer}>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: "#34d399" }]} />
                      <Text style={[styles.legendText, { color: theme.subText }]}>
                        {totalSpent > 0 ? `المصاريف (${totalSpent.toLocaleString()})` : "لا توجد مصاريف مسجلة"}
                      </Text>
                    </View>

                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: "#818cf8" }]} />
                      <Text style={[styles.legendText, { color: theme.subText }]}>
                        {totalInstallments > 0 ? `الأقساط (${totalInstallments.toLocaleString()})` : "لا توجد أقساط مسجلة"}
                      </Text>
                    </View>

                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: isDarkMode ? "#64748b" : "#9ca3af" }]} />
                      <Text style={[styles.legendText, { color: theme.subText }]}>
                        {totalOutflow === 0 ? "لا توجد معاملات" : "إجمالي العمليات"}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.miniStatsRow}>
                  <View style={[styles.miniStatBox, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
                    <Text style={[styles.miniStatLabel, { color: theme.subText }]}>
                      {language === "ar" ? "الميزانية الحالية" : "Current Budget"}
                    </Text>
                    <Text style={[styles.miniStatValue, { color: theme.text }]}>
                      {totalIncome.toLocaleString()} {selectedCurrency.symbol}
                    </Text>
                  </View>

                  <View style={[styles.miniStatBox, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
                    <Text style={[styles.miniStatLabel, { color: theme.subText }]}>
                      {language === "ar" ? "إجمالي المنصرف" : "Total Outflow"}
                    </Text>
                    <Text style={[styles.miniStatValue, { color: theme.text }]}>
                      {totalOutflow.toLocaleString()} {selectedCurrency.symbol}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </>
        ) : currentScreen === "installments" ? (
          /* ================= 💳 شاشة الأقساط والالتزامات ================= */
          <>
            <View style={styles.screenHeading}>
              <Text style={[styles.mainScreenTitle, { color: theme.text }]}>
                {language === "ar" ? "إدارة الأقساط والالتزامات" : "Installments Management"}
              </Text>
              <Text style={[styles.mainScreenSubtitle, { color: theme.subText }]}>
                {language === "ar"
                  ? "التزاماتك في مكان واحد، بخطوات أبسط."
                  : "All your obligations in one place, simplified."}
              </Text>
            </View>

            <View style={[styles.summaryInstallmentCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.summaryInstallmentTitle, { color: theme.text }]}>
                  {language === "ar" ? "إجمالي الأقساط الشهرية" : "Total Monthly Installments"}
                </Text>
                <Text style={[styles.summaryInstallmentSubtitle, { color: theme.subText }]}>
                  {installments.length === 0
                    ? "لا توجد التزامات مسجلة بعد"
                    : `${installments.length} التزامات مسجلة`}
                </Text>
              </View>

              <View style={styles.summaryInstallmentNumberCol}>
                <Text style={[styles.summaryInstallmentBigNumber, { color: theme.text }]}>
                  {totalInstallments.toLocaleString()}
                </Text>
                <Text style={[styles.summaryInstallmentSymbol, { color: theme.subText }]}>
                  {selectedCurrency.symbol}
                </Text>
              </View>
            </View>

            <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border, marginTop: 16 }]}>
              <Text style={[styles.cardHeading, { color: theme.text, marginBottom: 14 }]}>
                {language === "ar" ? "إضافة قسط جديد" : "Add New Installment"}
              </Text>

              <Text style={[styles.fieldLabel, { color: theme.subText }]}>
                {language === "ar" ? "اسم القسط" : "Installment Name"}
              </Text>
              <TextInput
                style={[styles.simpleInput, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
                placeholder={language === "ar" ? "...اسم القسط" : "Installment name..."}
                placeholderTextColor={isDarkMode ? "#475569" : "#9ca3af"}
                value={installTitle}
                onChangeText={setInstallTitle}
              />

              <Text style={[styles.fieldLabel, { color: theme.subText, marginTop: 12 }]}>
                {language === "ar" ? "قيمة القسط الشهري" : "Monthly Installment Value"}
              </Text>
              <View style={[styles.currencyInputContainer, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
                <TextInput
                  style={[styles.currencyInputText, { color: theme.text }]}
                  placeholder="0"
                  placeholderTextColor={isDarkMode ? "#475569" : "#9ca3af"}
                  keyboardType="numeric"
                  value={installAmount}
                  onChangeText={setInstallAmount}
                />
                <Text style={[styles.currencyInputBadge, { color: theme.subText }]}>{selectedCurrency.symbol}</Text>
              </View>

              <TouchableOpacity
                style={styles.primaryActionButton}
                onPress={handleAddInstallment}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryActionButtonText}>
                  {language === "ar" ? "+ إضافة القسط" : "+ Add Installment"}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.sectionHeaderRow, { marginTop: 24 }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                {language === "ar" ? "الأقساط النشطة حالياً" : "Currently Active Installments"}
              </Text>
              <View style={[styles.countBadge, { backgroundColor: theme.inputBg }]}>
                <Text style={[styles.countBadgeText, { color: theme.subText }]}>{installments.length}</Text>
              </View>
            </View>

            {installments.length === 0 ? (
              <View style={[styles.emptyCardCenter, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                <View style={[styles.emptyIconBoxCenter, { backgroundColor: theme.emptyIconContainerBg }]}>
                  <CardIcon color={theme.emptyIconColor} size={26} />
                </View>
                <Text style={[styles.emptyTitleCenter, { color: theme.text }]}>
                  {language === "ar" ? "لا توجد أقساط مسجلة." : "No installments registered."}
                </Text>
                <Text style={[styles.emptySubtitleCenter, { color: theme.subText }]}>
                  {language === "ar"
                    ? "أضف قسطك الأول من الأعلى لتتابع التزاماتك الشهرية بوضوح."
                    : "Add your first installment from above to track your monthly obligations clearly."}
                </Text>
              </View>
            ) : (
              installments.map((item) => (
                <View
                  key={item.id}
                  style={[styles.listItemRow, { backgroundColor: theme.cardBg, borderColor: theme.border }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.listItemTitle, { color: theme.text }]}>
                      {item.title}
                    </Text>
                    <Text style={[styles.listItemAmountRed, { color: "#818cf8" }]}>
                      -{Number(item.amount).toLocaleString()} {selectedCurrency.symbol}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.deleteActionBtn}
                    onPress={() => handleDeleteInstallment(item.id)}
                  >
                    <Text style={styles.deleteActionText}>حذف</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}

            <View style={styles.tipNoticeRow}>
              <InfoIcon color={theme.subText} size={16} />
              <Text style={[styles.tipNoticeText, { color: theme.subText }]}>
                {language === "ar"
                  ? "تُحتسب الأقساط ضمن إجمالي المنصرف في الرئيسية، لتبقى ميزانيتك واضحة."
                  : "Installments are included in total outflow on the home screen to keep your budget clear."}
              </Text>
            </View>
          </>
        ) : (
          /* ================= ⚙️ شاشة الإعدادات ================= */
          <>
            <View style={styles.screenHeading}>
              <Text style={[styles.mainScreenTitle, { color: theme.text }]}>
                {language === "ar" ? "إعدادات التطبيق" : "App Settings"}
              </Text>
              <Text style={[styles.mainScreenSubtitle, { color: theme.subText }]}>
                {language === "ar"
                  ? "باقي، بالطريقة اللي تناسبك."
                  : "Baqi, personalized for you."}
              </Text>
            </View>

            <Text style={[styles.settingsGroupHeader, { color: theme.subText }]}>
              {language === "ar" ? "التفضيلات العامة" : "General Preferences"}
            </Text>

            <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
              <View style={styles.settingItemHeaderRow}>
                <View style={[styles.settingIconContainer, { backgroundColor: theme.settingsIconBg }]}>
                  <CashIcon color={theme.settingsIconColor} size={22} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.settingItemTitle, { color: theme.text }]}>
                    {language === "ar" ? "العملة الرئيسية" : "Main Currency"}
                  </Text>
                  <Text style={[styles.settingItemSubtitle, { color: theme.subText }]}>
                    {language === "ar" ? "عملة الميزانية والمصاريف والأقساط" : "Budget, expenses, and installments currency"}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.currencySelectorPill, { backgroundColor: theme.inputBg, borderColor: theme.border }]}
                onPress={() => setCurrencyModalVisible(true)}
                activeOpacity={0.7}
              >
                <Text style={[styles.currencySelectorCode, { color: isDarkMode ? "#34d399" : "#059669" }]}>
                  {selectedCurrency.code}
                </Text>
                <Text style={[styles.currencySelectorName, { color: theme.text }]}>
                  {selectedCurrency.name} ({selectedCurrency.symbol})
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.settingsGroupHeader, { color: theme.subText, marginTop: 20 }]}>
              {language === "ar" ? "المظهر واللغة" : "Appearance & Language"}
            </Text>

            <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
              <View style={styles.settingRowBetween}>
                <View style={styles.settingItemHeaderRow}>
                  <View style={[styles.settingIconContainer, { backgroundColor: theme.settingsIconBg }]}>
                    <MoonIcon color={theme.settingsIconColor} size={22} />
                  </View>
                  <View>
                    <Text style={[styles.settingItemTitle, { color: theme.text }]}>
                      {language === "ar" ? "الوضع الداكن" : "Dark Mode"}
                    </Text>
                    <Text style={[styles.settingItemSubtitle, { color: theme.subText }]}>
                      {isDarkMode ? "مفعل - Dark Mode" : "غير مفعل - Dark Mode"}
                    </Text>
                  </View>
                </View>

                <Switch
                  value={isDarkMode}
                  onValueChange={handleToggleDarkMode}
                  trackColor={{ false: "#d1d5db", true: "#34d399" }}
                  thumbColor="#ffffff"
                />
              </View>

              <View style={[styles.settingDivider, { backgroundColor: theme.border }]} />

              <View style={styles.settingItemHeaderRow}>
                <View style={[styles.settingIconContainer, { backgroundColor: theme.settingsIconBg }]}>
                  <LanguageIcon color={theme.settingsIconColor} size={22} />
                </View>
                <View>
                  <Text style={[styles.settingItemTitle, { color: theme.text }]}>
                    {language === "ar" ? "لغة التطبيق" : "App Language"}
                  </Text>
                  <Text style={[styles.settingItemSubtitle, { color: theme.subText }]}>
                    {language === "ar" ? "اختر اللغة المفضلة لك" : "Choose your preferred language"}
                  </Text>
                </View>
              </View>

              <View style={styles.languageButtonsRow}>
                <TouchableOpacity
                  style={[
                    styles.langChoiceButton,
                    language === "en"
                      ? [styles.langChoiceButtonActive, { backgroundColor: theme.langActiveBg, borderColor: theme.langActiveBorder }]
                      : { backgroundColor: theme.inputBg, borderColor: theme.border },
                  ]}
                  onPress={() => handleSelectLanguage("en")}
                >
                  <Text
                    style={[
                      styles.langChoiceText,
                      { color: language === "en" ? theme.langActiveText : theme.subText },
                    ]}
                  >
                    English {language === "en" ? "✓" : ""}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.langChoiceButton,
                    language === "ar"
                      ? [styles.langChoiceButtonActive, { backgroundColor: theme.langActiveBg, borderColor: theme.langActiveBorder }]
                      : { backgroundColor: theme.inputBg, borderColor: theme.border },
                  ]}
                  onPress={() => handleSelectLanguage("ar")}
                >
                  <Text
                    style={[
                      styles.langChoiceText,
                      { color: language === "ar" ? theme.langActiveText : theme.subText },
                    ]}
                  >
                    العربية {language === "ar" ? "✓" : ""}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.settingsFooterBranding}>
              <DiamondLogo size={24} color={theme.goldColor} />
              <Text style={[styles.footerBrandName, { color: theme.text }]}>
                باقي | Baqi
              </Text>
              <Text style={[styles.footerBrandSlogan, { color: theme.subText }]}>
                كل ريال، بحساب. وكل خطوة، براحة.
              </Text>
            </View>
          </>
        )}
      </ScrollView>

      {/* ================= 🔘 شريط التنقل السفلي الفخم ================= */}
      <View style={[styles.bottomNavBar, { backgroundColor: theme.bottomNavBg, borderTopColor: theme.border }]}>
        <TouchableOpacity
          style={styles.navTab}
          onPress={() => setCurrentScreen("settings")}
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.navTabPill,
              currentScreen === "settings" && [
                styles.navTabPillActive,
                { backgroundColor: theme.navActivePillBg, borderColor: theme.navActiveBorder },
              ],
            ]}
          >
            <SettingsIcon
              color={currentScreen === "settings" ? theme.navActiveText : theme.navInactiveText}
              size={20}
            />
            <Text
              style={[
                styles.navTabLabel,
                { color: currentScreen === "settings" ? theme.navActiveText : theme.navInactiveText },
              ]}
            >
              {language === "ar" ? "الإعدادات" : "Settings"}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navTab}
          onPress={() => setCurrentScreen("home")}
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.navTabPill,
              currentScreen === "home" && [
                styles.navTabPillActive,
                { backgroundColor: theme.navActivePillBg, borderColor: theme.navActiveBorder },
              ],
            ]}
          >
            <HomeIcon
              color={currentScreen === "home" ? theme.navActiveText : theme.navInactiveText}
              size={20}
            />
            <Text
              style={[
                styles.navTabLabel,
                { color: currentScreen === "home" ? theme.navActiveText : theme.navInactiveText },
              ]}
            >
              {language === "ar" ? "الرئيسية" : "Home"}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navTab}
          onPress={() => setCurrentScreen("installments")}
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.navTabPill,
              currentScreen === "installments" && [
                styles.navTabPillActive,
                { backgroundColor: theme.navActivePillBg, borderColor: theme.navActiveBorder },
              ],
            ]}
          >
            <CardIcon
              color={currentScreen === "installments" ? theme.navActiveText : theme.navInactiveText}
              size={20}
            />
            <Text
              style={[
                styles.navTabLabel,
                { color: currentScreen === "installments" ? theme.navActiveText : theme.navInactiveText },
              ]}
            >
              {language === "ar" ? "الأقساط" : "Installments"}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* ================= 🎙️ نافذة تسجيل المصروف الصوتي المتطورة ================= */}
      <Modal
        visible={isVoiceModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          stopListening();
          setVoiceModalVisible(false);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.voiceModalCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <Text style={[styles.modalCardTitle, { color: theme.text, textAlign: "center" }]}>
              {language === "ar" ? "إضافة مصروف بالصوت 🎙️" : "Voice Expense 🎙️"}
            </Text>

            {/* الدائرة التفاعلية للميكروفون */}
            <View style={styles.voiceMicContainer}>
              <TouchableOpacity
                style={[
                  styles.voiceMicBigCircle,
                  isListening && styles.voiceMicBigCircleActive,
                ]}
                onPress={() => {
                  if (hasSpeechNative) {
                    isListening ? stopListening() : startListening();
                  } else {
                    // في Expo Go: نفتح الكيبورد ونركز على حقل الإدخال
                    voiceInputRef.current?.focus();
                  }
                }}
                activeOpacity={0.8}
              >
                <MicIcon color="#052419" size={32} />
              </TouchableOpacity>
              {isListening && (
                <View style={styles.listeningStatusRow}>
                  <ActivityIndicator size="small" color="#34d399" />
                  <Text style={[styles.listeningStatusText, { color: isDarkMode ? "#34d399" : "#059669" }]}>
                    جاري الاستماع...
                  </Text>
                </View>
              )}
            </View>

            <Text style={[styles.voiceHintText, { color: theme.subText }]}>
              {isListening
                ? (language === "ar"
                    ? "تحدث بوضوح مثل: «غداء 45» أو «بنزين 120»"
                    : "Speak clearly, e.g. \"Lunch 45\" or \"Gas 120\"")
                : hasSpeechNative
                  ? (language === "ar"
                      ? "اضغط على المايك وتحدث، وسيقوم باقي بفصل الاسم والمبلغ تلقائياً"
                      : "Tap the mic and speak, Baqi will separate title & amount")
                  : (language === "ar"
                      ? "💡 اضغط على حقل الإدخال بالأسفل ثم استخدم 🎙️ ميكروفون الكيبورد للإملاء الصوتي، أو اكتب يدوياً مثل: «غداء 45»"
                      : "💡 Tap the input below and use your keyboard's 🎙️ mic for voice dictation, or type e.g. \"Lunch 45\"")}
            </Text>

            {/* حقل الإدخال الصوتي المباشر */}
            <View style={[styles.transcriptBox, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
              <Text style={[styles.transcriptLabel, { color: theme.subText }]}>
                {language === "ar"
                  ? "🎙️ انطق أو اكتب المصروف (مثلاً: غداء 45):"
                  : "🎙️ Speak or type expense (e.g. Lunch 45):"}
              </Text>
              <TextInput
                ref={voiceInputRef}
                style={[styles.voiceInputDirect, { color: theme.text }]}
                placeholder={language === "ar" ? "مثال: قهوة 25 أو بنزين 120..." : "e.g. Coffee 25 or Gas 120..."}
                placeholderTextColor={isDarkMode ? "#475569" : "#9ca3af"}
                value={voiceTranscript}
                autoFocus={!hasSpeechNative}
                onChangeText={(text) => {
                  setVoiceTranscript(text);
                  const parsed = parseArabicExpense(text);
                  if (parsed.title) setVoiceTitle(parsed.title);
                  if (parsed.amount) setVoiceAmount(parsed.amount);
                }}
              />
            </View>

            {/* الحقول المستخرجة بذكاء (يمكن تعديلها مباشرة) */}
            <View style={{ marginTop: 10 }}>
              <Text style={[styles.fieldLabel, { color: theme.subText }]}>
                {language === "ar" ? "اسم المصروف المكتشف:" : "Detected Title:"}
              </Text>
              <TextInput
                style={[styles.simpleInput, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
                placeholder={language === "ar" ? "مثال: قهوة، عشاء، مواصلات" : "Title..."}
                placeholderTextColor={isDarkMode ? "#475569" : "#9ca3af"}
                value={voiceTitle}
                onChangeText={setVoiceTitle}
              />

              <Text style={[styles.fieldLabel, { color: theme.subText, marginTop: 10 }]}>
                {language === "ar" ? "المبلغ المكتشف:" : "Detected Amount:"}
              </Text>
              <View style={[styles.currencyInputContainer, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
                <TextInput
                  style={[styles.currencyInputText, { color: theme.text }]}
                  placeholder="0"
                  placeholderTextColor={isDarkMode ? "#475569" : "#9ca3af"}
                  keyboardType="numeric"
                  value={voiceAmount}
                  onChangeText={setVoiceAmount}
                />
                <Text style={[styles.currencyInputBadge, { color: theme.subText }]}>{selectedCurrency.symbol}</Text>
              </View>
            </View>

            {/* أزرار الإجراءات */}
            <TouchableOpacity
              style={[
                styles.primaryActionButton,
                (!voiceTitle || !voiceAmount) && { opacity: 0.6 },
              ]}
              onPress={handleConfirmVoiceExpense}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryActionButtonText}>
                {language === "ar" ? "✓ تأكيد وإضافة المصروف" : "✓ Confirm & Add Expense"}
              </Text>
            </TouchableOpacity>

            <View style={styles.voiceSecondaryButtonsRow}>
              {hasSpeechNative ? (
                <TouchableOpacity
                  style={[styles.voiceSecondaryBtn, { backgroundColor: theme.inputBg, borderColor: theme.border }]}
                  onPress={isListening ? stopListening : startListening}
                >
                  <Text style={[styles.voiceSecondaryBtnText, { color: theme.text }]}>
                    {isListening
                      ? (language === "ar" ? "⏹ إيقاف الاستماع" : "⏹ Stop")
                      : (language === "ar" ? "🎙 تحدث مجدداً" : "🎙 Speak again")}
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.voiceSecondaryBtn, { backgroundColor: theme.inputBg, borderColor: theme.border }]}
                  onPress={() => voiceInputRef.current?.focus()}
                >
                  <Text style={[styles.voiceSecondaryBtnText, { color: theme.text }]}>
                    {language === "ar" ? "🎙 استخدم ميكروفون الكيبورد" : "🎙 Use keyboard mic"}
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.voiceSecondaryBtn, { backgroundColor: theme.inputBg, borderColor: theme.border }]}
                onPress={() => {
                  stopListening();
                  setVoiceModalVisible(false);
                }}
              >
                <Text style={[styles.voiceSecondaryBtnText, { color: theme.subText }]}>
                  {language === "ar" ? "إلغاء" : "Cancel"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ================= ➕ نافذة إضافة مصروف يدوي (Image 1) ================= */}
      <Modal
        visible={isAddExpenseModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setAddExpenseModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.addExpenseModalCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <Text style={[styles.modalCardTitle, { color: theme.text }]}>
              {language === "ar" ? "إضافة مصروف جديد" : "Add New Expense"}
            </Text>

            <Text style={[styles.fieldLabel, { color: theme.subText }]}>
              {language === "ar" ? "اسم المصروف" : "Expense Name"}
            </Text>
            <TextInput
              style={[styles.simpleInput, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
              placeholder={language === "ar" ? "...اسم المصروف (أكل، مواصلات)" : "e.g. Food, Transport..."}
              placeholderTextColor={isDarkMode ? "#475569" : "#9ca3af"}
              value={expenseTitle}
              onChangeText={setExpenseTitle}
            />

            <Text style={[styles.fieldLabel, { color: theme.subText, marginTop: 14 }]}>
              {language === "ar" ? "المبلغ" : "Amount"}
            </Text>
            <View style={[styles.currencyInputContainer, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
              <TextInput
                style={[styles.currencyInputText, { color: theme.text }]}
                placeholder="0"
                placeholderTextColor={isDarkMode ? "#475569" : "#9ca3af"}
                keyboardType="numeric"
                value={expenseAmount}
                onChangeText={setExpenseAmount}
              />
              <Text style={[styles.currencyInputBadge, { color: theme.subText }]}>{selectedCurrency.symbol}</Text>
            </View>

            <TouchableOpacity
              style={styles.primaryActionButton}
              onPress={handleAddExpense}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryActionButtonText}>
                {language === "ar" ? "+ إضافة المصروف" : "+ Add Expense"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ marginTop: 14, alignItems: "center" }}
              onPress={() => setAddExpenseModalVisible(false)}
            >
              <Text style={{ color: theme.subText, fontSize: 13 }}>
                {language === "ar" ? "إلغاء" : "Cancel"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ================= 🌍 نافذة اختيار العملة ================= */}
      <Modal
        visible={isCurrencyModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setCurrencyModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.currencyModalCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <Text style={[styles.modalCardTitle, { color: theme.text, textAlign: "center" }]}>
              {language === "ar" ? "اختر عملتك الرئيسية 🌍" : "Select Main Currency 🌍"}
            </Text>

            <TextInput
              style={[styles.simpleInput, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text, marginTop: 12 }]}
              placeholder={language === "ar" ? "ابحث عن العملة أو الرمز..." : "Search currency..."}
              placeholderTextColor={isDarkMode ? "#475569" : "#9ca3af"}
              value={currencySearch}
              onChangeText={setCurrencySearch}
            />

            <FlatList
              data={filteredCurrencies}
              keyExtractor={(item) => item.code}
              style={{ marginTop: 10, maxHeight: 320 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.currencyListItem,
                    { borderBottomColor: theme.border },
                    selectedCurrency.code === item.code && { backgroundColor: isDarkMode ? "#063d2e33" : "#e6f7f0" },
                  ]}
                  onPress={() => handleSelectCurrency(item)}
                >
                  <Text style={styles.currencyFlag}>{item.flag}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.currencyItemName, { color: theme.text }]}>
                      {item.name} ({item.code})
                    </Text>
                  </View>
                  <Text style={[styles.currencyItemSymbol, { color: isDarkMode ? "#34d399" : "#059669" }]}>
                    {item.symbol}
                  </Text>
                </TouchableOpacity>
              )}
            />

            <TouchableOpacity
              style={[styles.closeModalBtn, { backgroundColor: isDarkMode ? "#162832" : "#e5e7eb" }]}
              onPress={() => setCurrencyModalVisible(false)}
            >
              <Text style={[styles.closeModalBtnText, { color: isDarkMode ? "#ffffff" : "#111827" }]}>
                {language === "ar" ? "إغلاق" : "Close"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ================= 🎨 StyleSheet =================
const svgStyles = StyleSheet.create({
  watermarkContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 110,
    height: 120,
    zIndex: 1,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topHeader: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
  },
  brandRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
  brandSlogan: {
    fontSize: 11,
    fontWeight: "500",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 100,
  },
  screenHeading: {
    marginBottom: 16,
  },
  mainScreenTitle: {
    fontSize: 26,
    fontWeight: "bold",
    textAlign: "right",
  },
  mainScreenSubtitle: {
    fontSize: 13,
    textAlign: "right",
    marginTop: 4,
  },

  // كرت الهيرو
  heroCard: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    position: "relative",
    overflow: "hidden",
    marginBottom: 16,
  },
  heroLabel: {
    fontSize: 13,
    textAlign: "right",
    fontWeight: "600",
    zIndex: 2,
  },
  heroAmountRow: {
    flexDirection: "row-reverse",
    alignItems: "baseline",
    justifyContent: "flex-start",
    marginTop: 6,
    zIndex: 2,
  },
  heroAmountNumber: {
    fontSize: 44,
    fontWeight: "bold",
  },
  heroAmountSymbol: {
    fontSize: 16,
    fontWeight: "bold",
  },
  heroSubNote: {
    fontSize: 12,
    textAlign: "right",
    marginTop: 2,
    zIndex: 2,
  },
  heroDivider: {
    height: 1,
    marginVertical: 14,
    zIndex: 2,
  },
  heroStatsRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    zIndex: 2,
  },
  heroStatItem: {
    alignItems: "flex-end",
  },
  heroStatLabel: {
    fontSize: 12,
  },
  heroStatValue: {
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 3,
  },

  // الكروت القياسية
  card: {
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    marginBottom: 16,
  },
  cardHeading: {
    fontSize: 15,
    fontWeight: "bold",
    textAlign: "right",
    marginBottom: 10,
  },

  // حقل إدخال العملة
  currencyInputContainer: {
    borderRadius: 12,
    borderWidth: 1,
    height: 48,
    paddingHorizontal: 14,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },
  currencyInputText: {
    flex: 1,
    fontSize: 14,
    textAlign: "right",
  },
  currencyInputBadge: {
    fontSize: 13,
    fontWeight: "bold",
  },

  // أزرار العمليات العائمة بتوسيط مثالي
  actionButtonsRow: {
    flexDirection: "row-reverse",
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
    marginBottom: 20,
    marginTop: 6,
  },
  circleActionButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#34d399",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#34d399",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },

  // رؤوس الأقسام
  sectionHeaderRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "right",
  },
  sectionSubtitle: {
    fontSize: 12,
    textAlign: "right",
    marginTop: 2,
  },
  countBadge: {
    minWidth: 26,
    height: 26,
    paddingHorizontal: 8,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: "bold",
  },

  // كروت الحالة الفارغة
  emptyCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 14,
  },
  emptyIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyTextContainer: {
    flex: 1,
    alignItems: "flex-end",
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: "bold",
    textAlign: "right",
  },
  emptySubtitle: {
    fontSize: 12,
    textAlign: "right",
    marginTop: 3,
  },

  // عناصر القوائم
  listItemRow: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  listItemTitle: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "right",
  },
  listItemAmountRed: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#ef4444",
    textAlign: "right",
    marginTop: 3,
  },
  deleteActionBtn: {
    backgroundColor: "#ef44441a",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  deleteActionText: {
    color: "#ef4444",
    fontSize: 12,
    fontWeight: "bold",
  },

  // قسم التقارير والإحصائيات
  reportTopRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  reportHeaderTitle: {
    fontSize: 14,
    fontWeight: "bold",
  },
  reportStateBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  reportStateTag: {
    fontSize: 11,
    fontWeight: "500",
  },
  chartAndLegendRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: 6,
  },
  legendContainer: {
    gap: 8,
    alignItems: "flex-end",
  },
  legendItem: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
  },
  miniStatsRow: {
    flexDirection: "row-reverse",
    gap: 12,
    marginTop: 18,
  },
  miniStatBox: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    alignItems: "center",
  },
  miniStatLabel: {
    fontSize: 11,
    marginBottom: 4,
  },
  miniStatValue: {
    fontSize: 15,
    fontWeight: "bold",
  },

  // كروت الأقساط
  summaryInstallmentCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },
  summaryInstallmentTitle: {
    fontSize: 15,
    fontWeight: "bold",
    textAlign: "right",
  },
  summaryInstallmentSubtitle: {
    fontSize: 12,
    textAlign: "right",
    marginTop: 4,
  },
  summaryInstallmentNumberCol: {
    alignItems: "center",
  },
  summaryInstallmentBigNumber: {
    fontSize: 32,
    fontWeight: "bold",
  },
  summaryInstallmentSymbol: {
    fontSize: 12,
  },
  fieldLabel: {
    fontSize: 12,
    textAlign: "right",
    marginBottom: 6,
  },
  simpleInput: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    textAlign: "right",
  },
  primaryActionButton: {
    backgroundColor: "#34d399",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 16,
  },
  primaryActionButtonText: {
    color: "#052419",
    fontWeight: "bold",
    fontSize: 15,
  },
  emptyCardCenter: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
  },
  emptyIconBoxCenter: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  emptyTitleCenter: {
    fontSize: 15,
    fontWeight: "bold",
    textAlign: "center",
  },
  emptySubtitleCenter: {
    fontSize: 12,
    textAlign: "center",
    marginTop: 4,
    lineHeight: 18,
  },
  tipNoticeRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 4,
  },
  tipNoticeText: {
    fontSize: 12,
    flex: 1,
    textAlign: "right",
    lineHeight: 18,
  },

  // الإعدادات
  settingsGroupHeader: {
    fontSize: 13,
    fontWeight: "bold",
    textAlign: "right",
    marginBottom: 10,
    marginTop: 6,
  },
  settingItemHeaderRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
  },
  settingIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  settingItemTitle: {
    fontSize: 15,
    fontWeight: "bold",
    textAlign: "right",
  },
  settingItemSubtitle: {
    fontSize: 12,
    textAlign: "right",
    marginTop: 2,
  },
  currencySelectorPill: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 14,
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
  },
  currencySelectorName: {
    fontSize: 14,
    fontWeight: "600",
  },
  currencySelectorCode: {
    fontSize: 13,
    fontWeight: "bold",
  },
  settingRowBetween: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
  },
  settingDivider: {
    height: 1,
    marginVertical: 14,
  },
  languageButtonsRow: {
    flexDirection: "row-reverse",
    gap: 10,
    marginTop: 14,
  },
  langChoiceButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: "center",
  },
  langChoiceButtonActive: {
    borderWidth: 1.5,
  },
  langChoiceText: {
    fontSize: 14,
    fontWeight: "bold",
  },
  settingsFooterBranding: {
    alignItems: "center",
    marginTop: 36,
    marginBottom: 20,
    gap: 6,
  },
  footerBrandName: {
    fontSize: 14,
    fontWeight: "bold",
  },
  footerBrandSlogan: {
    fontSize: 11,
  },

  // 🔘 شريط التنقل السفلي الفخم
  bottomNavBar: {
    height: 74,
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  navTab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
  },
  navTabPill: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: 14,
  },
  navTabPillActive: {
    borderWidth: 1,
  },
  navTabLabel: {
    fontSize: 11,
    fontWeight: "bold",
    marginTop: 3,
  },

  // 🎙️ نافذة تسجيل المصروف الصوتي
  voiceModalCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 22,
  },
  voiceMicContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 14,
  },
  voiceMicBigCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#34d399",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#34d399",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  voiceMicBigCircleActive: {
    backgroundColor: "#2dd4bf",
    borderWidth: 4,
    borderColor: "#a7f3d0",
  },
  listeningStatusRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
  },
  listeningStatusText: {
    fontSize: 14,
    fontWeight: "bold",
  },
  voiceHintText: {
    textAlign: "center",
    fontSize: 12,
    marginBottom: 10,
    lineHeight: 18,
  },
  transcriptBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  transcriptLabel: {
    fontSize: 11,
    textAlign: "right",
    marginBottom: 6,
  },
  voiceInputDirect: {
    fontSize: 15,
    fontWeight: "bold",
    textAlign: "right",
    paddingVertical: 6,
  },
  voiceSecondaryButtonsRow: {
    flexDirection: "row-reverse",
    gap: 10,
    marginTop: 12,
  },
  voiceSecondaryBtn: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: "center",
  },
  voiceSecondaryBtnText: {
    fontSize: 13,
    fontWeight: "bold",
  },

  // النوافذ المنبثقة
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    padding: 20,
  },
  addExpenseModalCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
  },
  modalCardTitle: {
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "right",
    marginBottom: 16,
  },
  currencyModalCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    maxHeight: "80%",
  },
  currencyListItem: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
  },
  currencyFlag: {
    fontSize: 22,
    marginLeft: 10,
  },
  currencyItemName: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "right",
  },
  currencyItemSymbol: {
    fontSize: 14,
    fontWeight: "bold",
  },
  closeModalBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 14,
  },
  closeModalBtnText: {
    fontWeight: "bold",
    fontSize: 14,
  },
});
