import React, { useRef, useState, useMemo, Suspense, useEffect, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import {
  Home,
  Shirt,
  Sparkles,
  Clock,
  Settings,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ChevronLeft,
  RotateCcw,
  Sun,
  GraduationCap,
  Wine,
  Briefcase,
  Heart,
  Grid,
  Check,
  Compass,
  ShoppingBag,
  Eye,
  SlidersHorizontal,
  Layers,
  Scissors,
  Sparkle,
  Footprints,
  Maximize2,
  Tv,
  Upload,
  Camera,
  LogIn,
  LogOut,
  User,
  X,
  Trash2,
  Database,
  AlertCircle
} from 'lucide-react';
import VRScene from './components/VRScene.jsx';
import ProductDetailsModal from './components/ProductDetailsModal.jsx';
import CartDrawer from './components/CartDrawer.jsx';
import WishlistDrawer from './components/WishlistDrawer.jsx';
import GroqAIPanel from './components/GroqAIPanel.jsx';
import GarmentExtractionModal from './components/GarmentExtractionModal.jsx';
import { PRODUCTS, CATEGORIES, getRecommendations } from './data/products.js';
import { analyzeClothingImage } from './services/aiService.js';
import { convert2DClothTo3D } from './services/imageTo3DService.js';
import { start3DGarmentGeneration, pollGarmentGenerationTask, extractGarmentOnly } from './services/tripoGarmentService.js';
import {
  getAuthToken,
  getSavedUser,
  ensureAuth,
  loginUser,
  logoutUser,
  getWardrobe,
  addClothingItem,
  uploadClothingImage,
  deleteClothingItem
} from './services/backendService.js';

// Loading fallback for 3D canvas
function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="loading-spinner" />
      <p className="loading-text">Loading Virtual Boutique…</p>
    </div>
  );
}

export default function App() {
  const controlsRef = useRef();

  // --- Avatar Position, Heading & Walking State ---
  const [avatarPosition, setAvatarPosition] = useState([0, 0, 0]);
  const [avatarRotation, setAvatarRotation] = useState([0, 0, 0]);
  const [isWalking, setIsWalking] = useState(false);

  // --- Virtual Try-On Wardrobe Outfit State ---
  const [currentOutfit, setCurrentOutfit] = useState({
    top: PRODUCTS.find((p) => p.id === 'top-1'),
    bottom: PRODUCTS.find((p) => p.id === 'trouser-1'),
    dress: null,
    outerwear: null,
    shoes: PRODUCTS.find((p) => p.id === 'shoe-1'),
    accessory: PRODUCTS.find((p) => p.id === 'acc-1')
  });

  const [isTryOnEffect, setIsTryOnEffect] = useState(false);

  // --- Camera & View State ---
  const [cameraMode, setCameraMode] = useState('follow');
  const [autoRotate, setAutoRotate] = useState(false);
  const [isZoomedIn, setIsZoomedIn] = useState(false);
  const [isVRActive, setIsVRActive] = useState(false);

  // --- Catalog, Filtering & Modals ---
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeOccasion, setActiveOccasion] = useState('Casual');
  const [selectedProduct, setSelectedProduct] = useState(null);

  // --- Cart & Wishlist State ---
  const [cartItems, setCartItems] = useState([
    {
      ...PRODUCTS[0],
      selectedSize: 'S',
      selectedColor: PRODUCTS[0].colors[0],
      quantity: 1
    }
  ]);
  const [wishlistItems, setWishlistItems] = useState([PRODUCTS[3], PRODUCTS[10]]);

  // --- Drawers Open/Close ---
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isWishlistOpen, setIsWishlistOpen] = useState(false);
  const [isStylistOpen, setIsStylistOpen] = useState(false);

  // --- Mobile Touch D-Pad State ---
  const [dpadInput, setDpadInput] = useState({ x: 0, y: 0 });
  const dpadTimerRef = useRef(null);

  // --- Upload Cloth Feature ---
  const [uploadedClothes, setUploadedClothes] = useState([]);
  const [isUploadingCloth, setIsUploadingCloth] = useState(false);
  const [uploadStatus, setUploadStatus]       = useState('');
  const [toast, setToast]                     = useState(null);
  const toastTimerRef                         = useRef(null);
  const fileInputRef = useRef(null);

  // --- Garment Extraction & Inspection Modal State ---
  const [extractionModal, setExtractionModal] = useState({
    isOpen: false,
    stage: 'extracting',
    originalImage: null,
    extractedImage: null,
    maskImage: null,
    geminiData: null,
    errorMessage: '',
    pendingFile: null,
  });

  // --- Wardrobe View Mode: 'wardrobe' (MongoDB) vs 'catalog' (Boutique) ---
  const [panelTab, setPanelTab]               = useState('wardrobe');

  // --- Backend Auth & Wardrobe State ---
  const [authToken, setAuthToken]             = useState(() => getAuthToken());
  const [currentUser, setCurrentUser]         = useState(() => getSavedUser());
  const [backendWardrobe, setBackendWardrobe] = useState([]);
  const [isLoadingWardrobe, setIsLoadingWardrobe] = useState(false);
  const [showLoginModal, setShowLoginModal]   = useState(false);
  const [loginEmail, setLoginEmail]           = useState('');
  const [loginPassword, setLoginPassword]     = useState('');
  const [loginError, setLoginError]           = useState('');
  const [isLoggingIn, setIsLoggingIn]         = useState(false);

  // Helper to trigger toast notification with optional error / success variant
  const showToast = useCallback((msg, type = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    const text = typeof msg === 'string' ? msg : msg?.text || '';
    setToast({ text, type });
    toastTimerRef.current = setTimeout(() => setToast(null), 3600);
  }, []);

  // On mount: ensure authentication and load all MongoDB wardrobe clothes
  useEffect(() => {
    let active = true;
    setIsLoadingWardrobe(true);

    const initWardrobe = async () => {
      try {
        const token = await ensureAuth();
        if (!active) return;
        if (token) {
          setAuthToken(token);
          setCurrentUser(getSavedUser());
          const clothes = await getWardrobe(token);
          if (active && clothes) {
            setBackendWardrobe(clothes);
          }
        }
      } catch (err) {
        console.warn('Initial wardrobe load error:', err.message);
      } finally {
        if (active) setIsLoadingWardrobe(false);
      }
    };

    initWardrobe();
    return () => { active = false; };
  }, []);

  // Fetch backend wardrobe whenever token changes
  useEffect(() => {
    if (!authToken) { setBackendWardrobe([]); return; }
    setIsLoadingWardrobe(true);
    getWardrobe(authToken)
      .then((items) => setBackendWardrobe(items))
      .catch(() => setBackendWardrobe([]))
      .finally(() => setIsLoadingWardrobe(false));
  }, [authToken]);

  // Login handler
  const handleLogin = useCallback(async (e) => {
    e?.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);
    try {
      const data = await loginUser(loginEmail, loginPassword);
      setAuthToken(data.token);
      setCurrentUser(data.user);
      setShowLoginModal(false);
      setLoginEmail('');
      setLoginPassword('');
      showToast('Signed in successfully! Wardrobe synced.');
    } catch (err) {
      setLoginError(err.message);
    } finally {
      setIsLoggingIn(false);
    }
  }, [loginEmail, loginPassword, showToast]);

  // Logout handler
  const handleLogout = useCallback(() => {
    logoutUser();
    setAuthToken(null);
    setCurrentUser(null);
    setBackendWardrobe([]);
    showToast('Signed out of WardrobeWise.');
  }, [showToast]);

  // Delete clothing item from MongoDB
  const handleDeleteWardrobeItem = useCallback(async (e, item) => {
    e.stopPropagation();
    if (!window.confirm(`Remove "${item.name}" from your MongoDB wardrobe?`)) return;
    try {
      const token = authToken || (await ensureAuth());
      const ok = await deleteClothingItem(token, item.backendId);
      if (ok) {
        setBackendWardrobe((prev) => prev.filter((i) => i.backendId !== item.backendId));
        setUploadedClothes((prev) => prev.filter((i) => i.id !== item.id));
        showToast(`"${item.name}" deleted from MongoDB`);
      }
    } catch (err) {
      console.warn('Delete error:', err.message);
    }
  }, [authToken, showToast]);

  // --- Handlers: Virtual Try-On ---
  const handleTryOn = (product) => {
    if (!product) return;
    setIsTryOnEffect(true);
    setTimeout(() => setIsTryOnEffect(false), 2000);
    showToast(`Dressed 3D Model in: ${product.name}`);

    setCurrentOutfit((prev) => {
      const next = { ...prev };
      const cat = (product.category || '').toLowerCase();
      const type = (product.garmentType || '').toLowerCase();
      const name = (product.name || '').toLowerCase();

      const isDress =
        cat === 'dresses' ||
        cat === 'dress' ||
        type === 'dress' ||
        name.includes('dress') ||
        name.includes('gown');

      const isTop =
        !isDress &&
        (cat === 'tops' ||
          cat === 'top' ||
          cat === 'shirt' ||
          cat === 't-shirt' ||
          type === 'top' ||
          name.includes('shirt') ||
          name.includes('top') ||
          name.includes('blouse') ||
          name.includes('tee') ||
          name.includes('sweater') ||
          name.includes('pullover'));

      const isBottom =
        !isDress &&
        (cat === 'trousers' ||
          cat === 'bottom' ||
          cat === 'bottoms' ||
          cat === 'jeans' ||
          cat === 'skirts' ||
          cat === 'skirt' ||
          type === 'bottom' ||
          name.includes('jean') ||
          name.includes('pant') ||
          name.includes('trouser') ||
          name.includes('skirt') ||
          name.includes('slacks'));

      const isOuterwear =
        !isDress &&
        (cat === 'outerwear' ||
          cat === 'jacket' ||
          cat === 'coat' ||
          type === 'outerwear' ||
          name.includes('jacket') ||
          name.includes('coat') ||
          name.includes('trench') ||
          name.includes('blazer'));

      const isShoes =
        cat === 'shoes' ||
        cat === 'footwear' ||
        type === 'shoes' ||
        name.includes('shoe') ||
        name.includes('sneaker') ||
        name.includes('heel') ||
        name.includes('pump') ||
        name.includes('sandal') ||
        name.includes('boot') ||
        name.includes('loafer');

      const isAccessory =
        cat === 'accessories' ||
        cat === 'accessory' ||
        cat === 'bags' ||
        cat === 'bag' ||
        type === 'accessory' ||
        name.includes('bag') ||
        name.includes('belt') ||
        name.includes('chain') ||
        name.includes('necklace') ||
        name.includes('jewelry');

      if (isDress) {
        next.dress = product;
        next.top = null;
        next.bottom = null;
      } else if (isTop) {
        next.top = product;
        next.dress = null;
        if (!next.bottom) {
          next.bottom = PRODUCTS.find((p) => p.category === 'trousers');
        }
      } else if (isBottom) {
        next.bottom = product;
        next.dress = null;
        if (!next.top) {
          next.top = PRODUCTS.find((p) => p.category === 'tops');
        }
      } else if (isOuterwear) {
        next.outerwear = prev.outerwear?.id === product.id ? null : product;
      } else if (isShoes) {
        next.shoes = product;
      } else if (isAccessory) {
        next.accessory = prev.accessory?.id === product.id ? null : product;
      }

      return next;
    });
  };

  const handleTryFullOutfit = (items) => {
    setIsTryOnEffect(true);
    setTimeout(() => setIsTryOnEffect(false), 2200);
    showToast('Applied curated outfit on 3D Model!');

    setCurrentOutfit((prev) => {
      const next = { ...prev };
      items.forEach((item) => {
        const cat = (item.category || '').toLowerCase();
        const type = (item.garmentType || '').toLowerCase();
        const name = (item.name || '').toLowerCase();

        const isDress =
          cat === 'dresses' ||
          cat === 'dress' ||
          type === 'dress' ||
          name.includes('dress') ||
          name.includes('gown');

        const isTop =
          !isDress &&
          (cat === 'tops' ||
            cat === 'top' ||
            cat === 'shirt' ||
            cat === 't-shirt' ||
            type === 'top');

        const isBottom =
          !isDress &&
          (cat === 'trousers' ||
            cat === 'bottom' ||
            cat === 'bottoms' ||
            cat === 'jeans' ||
            cat === 'skirts' ||
            cat === 'skirt' ||
            type === 'bottom');

        if (isDress) {
          next.dress = item;
          next.top = null;
          next.bottom = null;
        } else if (isTop) {
          next.top = item;
          next.dress = null;
        } else if (isBottom) {
          next.bottom = item;
          next.dress = null;
        } else if (cat === 'outerwear' || cat === 'jacket' || cat === 'coat') {
          next.outerwear = item;
        } else if (cat === 'shoes' || cat === 'footwear') {
          next.shoes = item;
        } else if (cat === 'accessories' || cat === 'accessory') {
          next.accessory = item;
        }
      });
      return next;
    });
  };

  const handleResetOutfit = () => {
    setIsTryOnEffect(true);
    setTimeout(() => setIsTryOnEffect(false), 1500);
    setCurrentOutfit({
      top: PRODUCTS.find((p) => p.id === 'top-1'),
      bottom: PRODUCTS.find((p) => p.id === 'trouser-1'),
      dress: null,
      outerwear: null,
      shoes: PRODUCTS.find((p) => p.id === 'shoe-1'),
      accessory: PRODUCTS.find((p) => p.id === 'acc-1')
    });
  };



  // --- Handlers: Shopping Bag ---
  const handleAddToCart = (product) => {
    setCartItems((prev) => {
      const existing = prev.find(
        (i) =>
          i.id === product.id &&
          i.selectedSize === product.selectedSize &&
          i.selectedColor?.name === product.selectedColor?.name
      );
      if (existing) {
        return prev.map((i) =>
          i === existing ? { ...i, quantity: (i.quantity || 1) + (product.quantity || 1) } : i
        );
      }
      return [...prev, { ...product, quantity: product.quantity || 1 }];
    });
  };

  const handleUpdateQuantity = (id, newQty) => {
    setCartItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, quantity: newQty } : item))
    );
  };

  const handleRemoveFromCart = (id) => {
    setCartItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearCart = () => {
    setCartItems([]);
  };

  // --- Handlers: Wishlist ---
  const handleToggleWishlist = (product) => {
    setWishlistItems((prev) => {
      const exists = prev.some((i) => i.id === product.id);
      if (exists) {
        return prev.filter((i) => i.id !== product.id);
      } else {
        return [...prev, product];
      }
    });
  };

  const handleRemoveFromWishlist = (id) => {
    setWishlistItems((prev) => prev.filter((i) => i.id !== id));
  };

  // --- Handlers: Camera Controls ---
  const toggleAutoRotate = () => setAutoRotate((prev) => !prev);

  const toggleCameraMode = () => {
    setCameraMode((prev) => (prev === 'follow' ? 'free' : 'follow'));
  };

  const toggleZoom = () => {
    if (!controlsRef.current) return;
    const ctrl = controlsRef.current;
    if (isZoomedIn) {
      ctrl.object.position.set(0, 1.9, 3.4);
      ctrl.target.set(avatarPosition[0], 1.75, avatarPosition[2]);
      setIsZoomedIn(false);
    } else {
      ctrl.object.position.set(avatarPosition[0], 2.2, avatarPosition[2] + 1.7);
      ctrl.target.set(avatarPosition[0], 2.2, avatarPosition[2]);
      setIsZoomedIn(true);
    }
  };

  const handleToggleWebXR = () => {
    if (navigator.xr && navigator.xr.isSessionSupported) {
      navigator.xr.isSessionSupported('immersive-vr').then((supported) => {
        if (supported) {
          navigator.xr.requestSession('immersive-vr').catch(() => {});
        } else {
          toggleFullscreen();
        }
      });
    } else {
      toggleFullscreen();
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsVRActive(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsVRActive(false);
    }
  };

  // --- Mobile D-Pad Touch Controller ---
  const handleDpadPress = (dx, dy) => {
    setDpadInput({ x: dx, y: dy });
    if (dpadTimerRef.current) clearInterval(dpadTimerRef.current);
    dpadTimerRef.current = setInterval(() => {
      setDpadInput({ x: dx, y: dy });
    }, 50);
  };

  const handleDpadRelease = () => {
    if (dpadTimerRef.current) {
      clearInterval(dpadTimerRef.current);
      dpadTimerRef.current = null;
    }
    setDpadInput({ x: 0, y: 0 });
  };

  // --- Upload Cloth Image Handler: Opens Garment Extraction & Inspection Pipeline ---
  const handleClothUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate that uploaded file is an image
    if (!file.type || !file.type.startsWith('image/')) {
      showToast('Please upload a valid clothing image (PNG, JPG, or WEBP).', 'error');
      if (e.target) e.target.value = '';
      return;
    }

    const localImageUrl = URL.createObjectURL(file);

    // Open Garment Extraction Modal in "extracting" state
    setExtractionModal({
      isOpen: true,
      stage: 'extracting',
      originalImage: localImageUrl,
      extractedImage: null,
      maskImage: null,
      geminiData: null,
      errorMessage: '',
      pendingFile: file,
    });

    try {
      // Execute OpenCV GrabCut + skin subtraction & Gemini fashion analysis
      const extractRes = await extractGarmentOnly(file);
      const extractedUrl = extractRes.extractedImageUrl
        ? (extractRes.extractedImageUrl.startsWith('http') ? extractRes.extractedImageUrl : `http://localhost:5000${extractRes.extractedImageUrl}`)
        : localImageUrl;
      const maskUrl = extractRes.maskUrl
        ? (extractRes.maskUrl.startsWith('http') ? extractRes.maskUrl : `http://localhost:5000${extractRes.maskUrl}`)
        : null;

      setExtractionModal((prev) => ({
        ...prev,
        stage: 'preview',
        extractedImage: extractedUrl,
        maskImage: maskUrl,
        geminiData: extractRes.geminiAnalysis || null,
      }));
    } catch (extractErr) {
      console.warn('[Garment Extraction Notice]:', extractErr.message);
      setExtractionModal((prev) => ({
        ...prev,
        stage: 'error',
        errorMessage: extractErr.message || 'Garment background removal encountered an issue. Please try again.',
      }));
    }

    if (e.target) e.target.value = '';
  };

  // --- Garment Extraction Confirmation: Runs 3D Generation & Virtual Try-On ---
  const handleConfirmExtraction = async () => {
    const file = extractionModal.pendingFile;
    if (!file) return;

    setExtractionModal((prev) => ({ ...prev, stage: 'synthesizing' }));
    setIsUploadingCloth(true);
    setUploadStatus('Generating 3D Garment with Gemini Multimodal AI…');

    try {
      const geminiData = extractionModal.geminiData;
      let detectedCategory = activeCategory !== 'all' ? activeCategory : 'tops';
      if (geminiData?.garmentCategory) {
        const cat = (geminiData.garmentCategory || '').toLowerCase();
        if (cat.includes('dress')) detectedCategory = 'dresses';
        else if (cat.includes('trouser') || cat.includes('pant') || cat.includes('jean') || cat.includes('skirt')) detectedCategory = 'trousers';
        else if (cat.includes('shoe') || cat.includes('footwear')) detectedCategory = 'shoes';
        else if (cat.includes('jacket') || cat.includes('coat')) detectedCategory = 'outerwear';
        else detectedCategory = 'tops';
      }

      let detectedName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      detectedName = detectedName.replace(/\b\w/g, (c) => c.toUpperCase());
      if (geminiData?.designAnalysis?.skirtStyle) {
        detectedName = `${geminiData.primaryColor || ''} ${geminiData.designAnalysis.skirtStyle} Dress`.trim();
      }

      let detectedColor = geminiData?.primaryColor || '#e5779c';
      let detectedPattern = geminiData?.patternType || 'Plain';
      let detectedTags = ['custom', 'uploaded', 'extracted', 'wardrobe'];
      if (detectedPattern) detectedTags.push(detectedPattern.toLowerCase());

      // 1. Cloud-Based 2D-to-3D Garment Generation
      let cloud3DResult = null;
      try {
        const initTask = await start3DGarmentGeneration(file, {
          category: detectedCategory,
          name: detectedName,
        });

        if (initTask?.taskId) {
          cloud3DResult = await pollGarmentGenerationTask(
            initTask.taskId,
            ({ progress }) => {
              setUploadStatus(`Generating 3D Garment with Gemini AI (${progress}%)…`);
            },
            60,
            1500,
            initTask
          );
        }
      } catch (cloudErr) {
        console.info('[Gemini 3D Generation Notice]:', cloudErr.message);
      }

      // 2. Texture & PBR Normal/Roughness Baking with clean extracted cloth image
      setUploadStatus('Baking Fabric PBR Materials…');
      let convertedPbr = null;
      let convertedCloth3D = null;
      const clothImageToBake = extractionModal.extractedImage || file;
      try {
        const cloth3D = await convert2DClothTo3D(clothImageToBake, {
          category: detectedCategory,
          color: detectedColor,
          name: detectedName,
          pattern: detectedPattern
        });
        if (cloth3D?.success && cloth3D.pbrMaterial) {
          convertedPbr = cloth3D.pbrMaterial;
          convertedCloth3D = cloth3D;
        }
      } catch (conversionErr) {
        console.warn('3D cloth conversion error:', conversionErr.message);
      }

      const displayImg = extractionModal.extractedImage || URL.createObjectURL(file);
      const isFloralOrPuff =
        detectedName.toLowerCase().includes('floral') ||
        detectedName.toLowerCase().includes('frock') ||
        detectedName.toLowerCase().includes('puff') ||
        (detectedTags || []).some((t) => (t || '').toLowerCase().includes('floral') || (t || '').toLowerCase().includes('puff'));

      const defaultDressModel = isFloralOrPuff
        ? '/models/garments/dress_floral_puff.glb'
        : '/models/garments/dress_slip.glb';

      let readyItem = {
        id: `custom-${Date.now()}`,
        name: detectedName || 'Custom Extracted Piece',
        category: detectedCategory,
        price: 110,
        discountPrice: null,
        rating: 5.0,
        reviewsCount: 1,
        description: 'Authentic 3D garment extracted from photo and fitted to female avatar.',
        details: ['Background & Person Removed', 'Auto-Rigged & Skeleton-Bound', 'High-Res PBR Textures'],
        sizes: ['XS', 'S', 'M', 'L'],
        colors: [{ name: 'Custom Hue', hex: detectedColor }],
        primaryColor: detectedColor,
        brand: 'My Closet',
        inStock: true,
        stockCount: 1,
        featured: true,
        tags: detectedTags,
        garmentType: detectedCategory === 'dresses' ? 'dress' : detectedCategory === 'trousers' ? 'bottom' : detectedCategory === 'shoes' ? 'shoes' : 'top',
        silhouette: cloud3DResult?.silhouette || (isFloralOrPuff ? 'floral-puff' : detectedCategory === 'dresses' ? 'slip-dress' : detectedCategory === 'trousers' ? 'wide-jeans' : 'custom'),
        position3D: [0, 2.0, -1.8],
        complementaryIds: [],
        image: displayImg,
        extractedImage: displayImg,
        pbrMaterial: convertedPbr,
        cloth3D: convertedCloth3D,
        modelUrl: cloud3DResult?.modelUrl || (detectedCategory === 'dresses' ? defaultDressModel : null),
        model3d: cloud3DResult,
      };

      // Virtual Try-on onto 3D Avatar
      handleTryOn(readyItem);
      setSelectedProduct(readyItem);
      setUploadedClothes((prev) => [readyItem, ...prev]);

      // Save to MongoDB Atlas
      setUploadStatus('Saving to MongoDB Atlas…');
      try {
        const token = authToken || (await ensureAuth());
        if (token) {
          if (!authToken) {
            setAuthToken(token);
            setCurrentUser(getSavedUser());
          }

          const savedBackendItem = await addClothingItem(token, {
            name:        readyItem.name,
            category:    detectedCategory,
            color:       detectedColor,
            brand:       'My Closet',
            description: readyItem.description,
            size:        'M',
            tags:        detectedTags,
            imageUrl:    extractionModal.extractedImage || displayImg,
            model3d:     readyItem.model3d || undefined
          });

          if (savedBackendItem?.backendId) {
            readyItem.backendId = savedBackendItem.backendId;
            readyItem.id = `backend_${savedBackendItem.backendId}`;
          }

          const freshList = await getWardrobe(token);
          if (freshList && freshList.length > 0) {
            setBackendWardrobe(freshList);
          }
        }
      } catch (saveErr) {
        console.warn('MongoDB save error:', saveErr.message);
      }

      setExtractionModal((prev) => ({ ...prev, isOpen: false }));
      showToast(`"${readyItem.name}" extracted & fitted onto avatar!`, 'success');
      setPanelTab('wardrobe');
    } catch (err) {
      console.error('Confirm extraction error:', err);
      setExtractionModal((prev) => ({
        ...prev,
        stage: 'error',
        errorMessage: err.message || 'Failed to synthesize 3D garment'
      }));
    } finally {
      setIsUploadingCloth(false);
      setUploadStatus('');
    }
  };

  // Filtered Products for Right Wardrobe Sidebar
  const displayedItems = useMemo(() => {
    // If in 'wardrobe' tab: show ONLY clothes stored in MongoDB (+ any active uploaded clothes)
    // If in 'catalog' tab: show boutique catalog products (PRODUCTS)
    let sourceList = panelTab === 'wardrobe'
      ? [...uploadedClothes.filter(u => !backendWardrobe.some(b => b.backendId === u.backendId)), ...backendWardrobe]
      : PRODUCTS;

    if (activeCategory !== 'all') {
      const cat = activeCategory.toLowerCase();
      sourceList = sourceList.filter((p) => {
        const itemCat = (p.category || '').toLowerCase();
        if (cat === 'tops') return itemCat === 'tops' || itemCat === 'top' || itemCat === 'shirt' || itemCat === 't-shirt';
        if (cat === 'trousers') return itemCat === 'trousers' || itemCat === 'skirts' || itemCat === 'skirt' || itemCat === 'bottom' || itemCat === 'bottoms' || itemCat === 'jeans';
        if (cat === 'dresses') return itemCat === 'dresses' || itemCat === 'dress';
        if (cat === 'outerwear') return itemCat === 'outerwear' || itemCat === 'jacket' || itemCat === 'coat' || itemCat === 'coats';
        if (cat === 'shoes') return itemCat === 'shoes' || itemCat === 'footwear';
        if (cat === 'accessories') return itemCat === 'accessories' || itemCat === 'accessory' || itemCat === 'bags' || itemCat === 'bag';
        return itemCat === cat;
      });
    }
    if (activeOccasion && activeOccasion !== 'All') {
      const occLower = activeOccasion.toLowerCase();
      const matched = sourceList.filter((p) => p.tags?.some((t) => t.toLowerCase().includes(occLower)));
      if (matched.length > 0) sourceList = matched;
    }
    return sourceList;
  }, [panelTab, activeCategory, activeOccasion, uploadedClothes, backendWardrobe]);

  return (
    <div className="app-root">

      {/* =========================================================
          3D WEBGL VIRTUAL BOUTIQUE CANVAS — Full Viewport Layer
          ========================================================= */}
      <div className="canvas-layer">
        <Canvas
          shadows
          camera={{ position: [0, 1.9, 3.4], fov: 44 }}
          gl={{
            antialias: true,
            alpha: false,
            powerPreference: 'high-performance'
          }}
          onCreated={({ gl }) => {
            gl.setClearColor('#14101f', 1);
          }}
        >
          <Suspense fallback={null}>
            <VRScene
              controlsRef={controlsRef}
              autoRotate={autoRotate}
              avatarPosition={avatarPosition}
              setAvatarPosition={setAvatarPosition}
              avatarRotation={avatarRotation}
              setAvatarRotation={setAvatarRotation}
              isWalking={isWalking}
              setIsWalking={setIsWalking}
              currentOutfit={currentOutfit}
              isTryOnEffect={isTryOnEffect}
              selectedProduct={selectedProduct}
              onSelectProduct={(p) => handleTryOn(p)}
              activeCategory={activeCategory}
              cameraMode={cameraMode}
              dpadInput={dpadInput}
              onResetDpad={() => setDpadInput({ x: 0, y: 0 })}
              avatarMode="demo"
              personalizedProfile={null}
            />
          </Suspense>
        </Canvas>
      </div>

      {/* Try-On Flash Toast */}
      {isTryOnEffect && (
        <div className="tryon-toast">
          <Sparkles size={15} className="text-pink-300" />
          <span>Trying on outfit…</span>
        </div>
      )}

      {/* Compact & Attractive Toast Notification */}
      {toast && (
        <div className={`elegant-toast ${toast.type || 'success'}`}>
          {toast.type === 'error' ? (
            <AlertCircle size={14} style={{ color: '#fb7185', flexShrink: 0 }} />
          ) : (
            <Sparkles size={14} style={{ color: '#f472b6', flexShrink: 0 }} />
          )}
          <span>{toast.text}</span>
        </div>
      )}

      {/* =========================================================
          TOP NAVIGATION BAR
          ========================================================= */}
      <header className="topbar">
        {/* Brand */}
        <div className="topbar-brand">
          <div className="brand-icon-wrap">
            <Shirt size={18} />
          </div>
          <div>
            <h1 className="brand-name">WardrobeWise</h1>
            <p className="brand-tagline">Your Style. Your Space. In VR.</p>
          </div>
        </div>

        {/* Right Controls */}
        <div className="topbar-actions">
<button
            onClick={toggleCameraMode}
            className={`topbar-pill-btn${cameraMode === 'follow' ? ' active' : ''}`}
            title="Toggle camera mode"
          >
            <Eye size={14} />
            <span>{cameraMode === 'follow' ? 'Following' : 'Free Cam'}</span>
          </button>

          <button
            onClick={handleResetOutfit}
            className="topbar-pill-btn"
            title="Reset outfit"
          >
            <RotateCcw size={13} />
            <span>Reset</span>
          </button>

          <button
            onClick={() => setIsWishlistOpen(true)}
            className="topbar-icon-btn"
            title="Wishlist"
          >
            <Heart size={17} />
            {wishlistItems.length > 0 && (
              <span className="topbar-badge">{wishlistItems.length}</span>
            )}
          </button>
        </div>
      </header>

      {/* =========================================================
          LEFT NAVIGATION DOCK
          ========================================================= */}
      <nav className="left-dock">
        <button
          className={`dock-btn${panelTab === 'wardrobe' ? ' active' : ''}`}
          title="My Wardrobe (MongoDB Atlas)"
          onClick={() => {
            setPanelTab('wardrobe');
            setActiveCategory('all');
          }}
        >
          <Shirt size={18} />
          <span>Wardrobe</span>
        </button>
<button
          className="dock-btn"
          title="AI Stylist"
          onClick={() => setIsStylistOpen(true)}
        >
          <Sparkle size={18} />
          <span>Stylist AI</span>
        </button>
        <button
          className="dock-btn"
          title="Favorites"
          onClick={() => setIsWishlistOpen(true)}
        >
          <Heart size={18} />
          <span>Favorites</span>
        </button>
        <button
          className="dock-btn"
          title="Auto-Rotate"
          onClick={toggleAutoRotate}
        >
          <Settings size={18} />
          <span>Rotate</span>
        </button>
      </nav>

      {/* =========================================================
          BOTTOM-LEFT D-PAD CONTROLLER
          ========================================================= */}
      <div className="dpad-wrap">
        <div className="dpad-disc">
          <div className="dpad-dot" />
          <button
            onPointerDown={() => handleDpadPress(0, 1)}
            onPointerUp={handleDpadRelease}
            onPointerLeave={handleDpadRelease}
            className="dpad-btn dpad-up"
            aria-label="Forward"
          >
            <ChevronUp size={15} />
          </button>
          <button
            onPointerDown={() => handleDpadPress(0, -1)}
            onPointerUp={handleDpadRelease}
            onPointerLeave={handleDpadRelease}
            className="dpad-btn dpad-down"
            aria-label="Backward"
          >
            <ChevronDown size={15} />
          </button>
          <button
            onPointerDown={() => handleDpadPress(-1, 0)}
            onPointerUp={handleDpadRelease}
            onPointerLeave={handleDpadRelease}
            className="dpad-btn dpad-left"
            aria-label="Left"
          >
            <ChevronLeft size={15} />
          </button>
          <button
            onPointerDown={() => handleDpadPress(1, 0)}
            onPointerUp={handleDpadRelease}
            onPointerLeave={handleDpadRelease}
            className="dpad-btn dpad-right"
            aria-label="Right"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      {/* =========================================================
          BOTTOM CENTER CONTROLS BAR
          ========================================================= */}
      <div className="bottom-bar">
<button
          onClick={toggleAutoRotate}
          className={`bar-btn${autoRotate ? ' active' : ''}`}
        >
          <RotateCcw size={14} />
          <span>{autoRotate ? 'Rotating' : 'Rotate 360°'}</span>
        </button>
        <button
          onClick={toggleZoom}
          className={`bar-btn${isZoomedIn ? ' active' : ''}`}
        >
          <Maximize2 size={14} />
          <span>{isZoomedIn ? 'Zoom Out' : 'Zoom In'}</span>
        </button>
        <button
          onClick={toggleCameraMode}
          className={`bar-btn${cameraMode === 'follow' ? ' active' : ''}`}
        >
          <Eye size={14} />
          <span>{cameraMode === 'follow' ? 'Follow' : 'Free Cam'}</span>
        </button>
        <button
          onClick={handleToggleWebXR}
          className={`bar-btn${isVRActive ? ' active' : ''}`}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="6" width="20" height="12" rx="4" />
            <circle cx="8" cy="12" r="2.5" />
            <circle cx="16" cy="12" r="2.5" />
          </svg>
          <span>VR Mode</span>
        </button>
      </div>

      {/* =========================================================
          RIGHT FLOATING WARDROBE PANEL
          ========================================================= */}
      <aside className="wardrobe-panel">

        {/* Wardrobe Header Tab */}
        <div className="wardrobe-mode-tabs">
          <button
            type="button"
            className="wardrobe-mode-tab active"
            onClick={() => setPanelTab('wardrobe')}
          >
            <Shirt size={14} />
            <span>My Wardrobe ({backendWardrobe.length})</span>
          </button>
        </div>

        {/* Auth Status & Sync Banner */}
        {!currentUser ? (
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px', borderRadius: 10, marginBottom: 14,
              background: 'rgba(158,123,181,0.12)', border: '1px solid rgba(158,123,181,0.25)',
              cursor: 'pointer'
            }}
            onClick={() => setShowLoginModal(true)}
          >
            <LogIn size={13} style={{ color: '#9e7bb5', flexShrink: 0 }} />
            <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.65)', lineHeight: 1.4 }}>
              <strong style={{ color: '#c4a8e0' }}>Sign in</strong> to sync your wardrobe &amp; save outfits
            </span>
          </div>
        ) : null}

        {/* Clothing Categories */}
        <div>
          <h2 className="panel-heading">Clothing Categories</h2>
          <div className="cat-grid">
            {[
              { key: 'all',         label: 'All',      Icon: Grid },
              { key: 'tops',        label: 'Tops',     Icon: Shirt },
              { key: 'trousers',    label: 'Bottoms',  Icon: Scissors },
              { key: 'dresses',     label: 'Dresses',  Icon: Sparkles },
              { key: 'outerwear',   label: 'Coats',    Icon: Layers },
              { key: 'shoes',       label: 'Shoes',    Icon: Footprints },
              { key: 'accessories', label: 'Bags',     Icon: ShoppingBag },
            ].map(({ key, label, Icon }) => (
              <button
                key={key}
                onClick={() => setActiveCategory(key)}
                className={`cat-tile${activeCategory === key ? ' active' : ''}`}
              >
                <Icon size={16} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Upload Cloth Feature (Stores directly in MongoDB Atlas) */}
        <div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleClothUpload}
            accept="image/*"
            style={{ display: 'none' }}
          />

          <div className="catalog-header">
            <h3 className="catalog-title">Upload Cloth to Wardrobe</h3>
          </div>

          {/* Dedicated Upload Button / Dropzone */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="upload-dropzone"
            disabled={isUploadingCloth}
            title="Upload cloth image from your computer to store in MongoDB Atlas and try on 3D avatar"
          >
            <div className="upload-dropzone-inner">
              <div className="upload-icon-circle">
                <Upload size={20} />
              </div>
              <div>
                <p className="upload-primary-text">
                  {isUploadingCloth ? (uploadStatus || 'Saving to MongoDB…') : 'Click to upload'}
                </p>
                {isUploadingCloth && (
                  <p className="upload-sub-text">
                    Processing AI Vision &amp; Database…
                  </p>
                )}
              </div>
            </div>
          </button>

          {/* Active Category Garments List (Directly reflects selected tab & category) */}
          <div style={{ marginTop: '14px' }}>
            <div className="catalog-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <h3 className="catalog-title">My Wardrobe Pieces</h3>
              </div>
              <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.55)' }}>
                {displayedItems.length} {displayedItems.length === 1 ? 'piece' : 'pieces'}
              </span>
            </div>

            {displayedItems.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '28px 16px',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px dashed rgba(255, 255, 255, 0.1)',
                marginTop: '10px'
              }}>
                <Shirt size={28} style={{ color: 'rgba(255,255,255,0.25)', margin: '0 auto 8px', display: 'block' }} />
                <p style={{ margin: '0 0 6px 0', fontSize: '12.5px', fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>
                  No saved clothes in this category
                </p>
                <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.4 }}>
                  Click "Click to upload" above to store custom pieces in your MongoDB database!
                </p>
              </div>
            ) : (
              <div className="garment-grid">
                {displayedItems.map((item) => {
                  const isSelected = selectedProduct?.id === item.id;
                  const isWearing =
                    currentOutfit.top?.id === item.id ||
                    currentOutfit.bottom?.id === item.id ||
                    currentOutfit.dress?.id === item.id ||
                    currentOutfit.outerwear?.id === item.id ||
                    currentOutfit.shoes?.id === item.id ||
                    currentOutfit.accessory?.id === item.id;

                  return (
                    <button
                      key={item.id}
                      onClick={() => handleTryOn(item)}
                      className={`garment-card${isWearing ? ' selected' : ''}`}
                      title={`${item.name} — Click to wear on 3D avatar`}
                    >
                      {item.image ? (
                        <img src={item.image} alt={item.name} className="garment-img" />
                      ) : (
                        <Shirt size={22} style={{ color: item.primaryColor }} />
                      )}
                      {isWearing && (
                        <span className="wearing-dot" title="Currently wearing on avatar">
                          <Check size={9} strokeWidth={3} />
                        </span>
                      )}
                      {item.backendId && (
                        <span
                          className="wardrobe-delete-btn"
                          onClick={(e) => handleDeleteWardrobeItem(e, item)}
                          title={`Delete "${item.name}" from MongoDB`}
                        >
                          <Trash2 size={11} />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Occasion Filter */}
        <div>
          <h2 className="panel-heading">Occasion</h2>
          <div className="occasion-grid">
            {[
              { key: 'Casual',  label: 'Casual',   Icon: Sun },
              { key: 'College', label: 'College',  Icon: GraduationCap },
              { key: 'Party',   label: 'Party',    Icon: Wine },
              { key: 'Office',  label: 'Office',   Icon: Briefcase },
              { key: 'All',     label: 'All',      Icon: Sparkle }
            ].map(({ key, label, Icon }) => (
              <button
                key={key}
                onClick={() => setActiveOccasion(key)}
                className={`occasion-pill${activeOccasion === key ? ' active' : ''}`}
              >
                <Icon size={11} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* AI Stylist CTA */}
        <div
          className="ai-cta-card"
          onClick={() => setIsStylistOpen(true)}
          role="button"
          tabIndex={0}
          title="AI Outfit Suggestions"
        >
          <div className="ai-cta-header">
            <Sparkles size={15} className="ai-cta-icon" />
            <h4 className="ai-cta-title">AI Outfit Suggestions</h4>
            <ChevronRight size={13} className="ai-cta-arrow" />
          </div>
          <p className="ai-cta-desc">
            Get personalized outfit ideas based on your style, occasion, and current look.
          </p>
        </div>
      </aside>

      {/* =========================================================
          PRODUCT DETAILS MODAL
          ========================================================= */}
      {selectedProduct && (
        <ProductDetailsModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onTryOn={handleTryOn}
          onAddToCart={handleAddToCart}
          onToggleWishlist={handleToggleWishlist}
          isWishlisted={wishlistItems.some((i) => i.id === selectedProduct.id)}
          isCurrentlyTriedOn={
            currentOutfit.top?.id === selectedProduct.id ||
            currentOutfit.bottom?.id === selectedProduct.id ||
            currentOutfit.dress?.id === selectedProduct.id ||
            currentOutfit.outerwear?.id === selectedProduct.id ||
            currentOutfit.shoes?.id === selectedProduct.id ||
            currentOutfit.accessory?.id === selectedProduct.id
          }
        />
      )}

      {/* =========================================================
          SHOPPING BAG DRAWER
          ========================================================= */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cartItems={cartItems}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveFromCart}
        onClearCart={handleClearCart}
      />

      {/* =========================================================
          WISHLIST DRAWER
          ========================================================= */}
      <WishlistDrawer
        isOpen={isWishlistOpen}
        onClose={() => setIsWishlistOpen(false)}
        wishlistItems={wishlistItems}
        onRemoveFromWishlist={handleRemoveFromWishlist}
        onAddToCart={handleAddToCart}
        onTryOn={handleTryOn}
      />

      {/* =========================================================
          GROQ RAG AI OUTFIT PANEL
          ========================================================= */}
      <GroqAIPanel
        isOpen={isStylistOpen}
        onClose={() => setIsStylistOpen(false)}
        onApplyOutfitToAvatar={(outfit) => {
          if (outfit?.clothingItems && Array.isArray(outfit.clothingItems)) {
            handleTryFullOutfit(outfit.clothingItems);
          } else {
            handleTryOn(outfit);
          }
        }}
        onTryOnItem={handleTryOn}
        mongoClothes={backendWardrobe}
      />

      {/* =========================================================
          LOGIN MODAL
          ========================================================= */}
      {showLoginModal && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(10,8,18,0.85)', backdropFilter: 'blur(12px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowLoginModal(false); }}
        >
          <div style={{
            background: 'linear-gradient(135deg,rgba(30,20,50,0.98),rgba(20,16,38,0.98))',
            border: '1px solid rgba(158,123,181,0.35)',
            borderRadius: 20, padding: '36px 32px', width: 340,
            boxShadow: '0 24px 64px rgba(0,0,0,0.7)'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div>
                <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 700, margin: 0 }}>Sign In</h2>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, margin: '4px 0 0' }}>Sync your wardrobe across sessions</p>
              </div>
              <button
                onClick={() => setShowLoginModal(false)}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleLogin}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', color: 'rgba(255,255,255,0.7)', fontSize: 12, marginBottom: 6, fontWeight: 600 }}>
                  Email
                </label>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="user@wardrobewise.com"
                  required
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: 10,
                    background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)',
                    color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box',
                    fontFamily: 'inherit'
                  }}
                />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', color: 'rgba(255,255,255,0.7)', fontSize: 12, marginBottom: 6, fontWeight: 600 }}>
                  Password
                </label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: 10,
                    background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)',
                    color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box',
                    fontFamily: 'inherit'
                  }}
                />
              </div>

              {loginError && (
                <p style={{
                  color: '#f87171', fontSize: 12, marginBottom: 14,
                  padding: '8px 12px', background: 'rgba(248,113,113,0.1)',
                  borderRadius: 8, border: '1px solid rgba(248,113,113,0.2)'
                }}>
                  {loginError}
                </p>
              )}

              <button
                type="submit"
                disabled={isLoggingIn}
                style={{
                  width: '100%', padding: '12px', borderRadius: 12,
                  background: 'linear-gradient(135deg,#9e7bb5,#e879a0)',
                  border: 'none', color: '#fff', fontSize: 14, fontWeight: 700,
                  cursor: isLoggingIn ? 'not-allowed' : 'pointer',
                  opacity: isLoggingIn ? 0.7 : 1, fontFamily: 'inherit',
                  letterSpacing: '0.3px'
                }}
              >
                {isLoggingIn ? 'Signing in…' : 'Sign In'}
              </button>

              <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 16 }}>
                Demo: user@wardrobewise.com · Password123!
              </p>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================
          GARMENT EXTRACTION & INSPECTION MODAL (OpenCV + Gemini AI)
          ========================================================= */}
      <GarmentExtractionModal
        isOpen={extractionModal.isOpen}
        onClose={() => setExtractionModal((prev) => ({ ...prev, isOpen: false }))}
        stage={extractionModal.stage}
        originalImage={extractionModal.originalImage}
        extractedImage={extractionModal.extractedImage}
        maskImage={extractionModal.maskImage}
        geminiData={extractionModal.geminiData}
        onConfirm3D={handleConfirmExtraction}
        onRetry={() => {
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
            fileInputRef.current.click();
          }
        }}
        errorMessage={extractionModal.errorMessage}
      />
    </div>
  );
}
