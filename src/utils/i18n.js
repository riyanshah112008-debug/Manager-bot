// ==========================================
// 🌐 STARRY CORE MULTILINGUAL LOCALIZATION ENGINE (i18n)
// File Path: src/utils/i18n.js
// 14 Global Languages • Instant In-Memory Cache • Zero-Latency Lookups
// ==========================================

const { ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// 1. Supported Languages Catalog
const SUPPORTED_LANGUAGES = {
    'en': {
        code: 'en',
        name: 'English',
        native: 'English',
        flag: '🇬🇧',
        locale: 'en-US',
        description: 'English (United Kingdom / United States)'
    },
    'es': {
        code: 'es',
        name: 'Spanish',
        native: 'Español',
        flag: '🇪🇸',
        locale: 'es-ES',
        description: 'Español (España y Latinoamérica)'
    },
    'pt': {
        code: 'pt',
        name: 'Portuguese',
        native: 'Português',
        flag: '🇧🇷',
        locale: 'pt-BR',
        description: 'Português (Brasil e Portugal)'
    },
    'ja': {
        code: 'ja',
        name: 'Japanese',
        native: '日本語',
        flag: '🇯🇵',
        locale: 'ja-JP',
        description: '日本語 (日本)'
    },
    'hi': {
        code: 'hi',
        name: 'Hindi',
        native: 'हिन्दी',
        flag: '🇮🇳',
        locale: 'hi-IN',
        description: 'हिन्दी (भारत)'
    },
    'fr': {
        code: 'fr',
        name: 'French',
        native: 'Français',
        flag: '🇫🇷',
        locale: 'fr-FR',
        description: 'Français (France et Canada)'
    },
    'de': {
        code: 'de',
        name: 'German',
        native: 'Deutsch',
        flag: '🇩🇪',
        locale: 'de-DE',
        description: 'Deutsch (Deutschland und Österreich)'
    },
    'ru': {
        code: 'ru',
        name: 'Russian',
        native: 'Русский',
        flag: '🇷🇺',
        locale: 'ru-RU',
        description: 'Русский (Россия)'
    },
    'id': {
        code: 'id',
        name: 'Indonesian',
        native: 'Bahasa Indonesia',
        flag: '🇮🇩',
        locale: 'id-ID',
        description: 'Bahasa Indonesia (Indonesia)'
    },
    'it': {
        code: 'it',
        name: 'Italian',
        native: 'Italiano',
        flag: '🇮🇹',
        locale: 'it-IT',
        description: 'Italiano (Italia)'
    },
    'vi': {
        code: 'vi',
        name: 'Vietnamese',
        native: 'Tiếng Việt',
        flag: '🇻🇳',
        locale: 'vi-VN',
        description: 'Tiếng Việt (Việt Nam)'
    },
    'tr': {
        code: 'tr',
        name: 'Turkish',
        native: 'Türkçe',
        flag: '🇹🇷',
        locale: 'tr-TR',
        description: 'Türkçe (Türkiye)'
    },
    'ar': {
        code: 'ar',
        name: 'Arabic',
        native: 'العربية',
        flag: '🇸🇦',
        locale: 'ar-SA',
        description: 'العربية (الشرق الأوسط)'
    },
    'ko': {
        code: 'ko',
        name: 'Korean',
        native: '한국어',
        flag: '🇰🇷',
        locale: 'ko-KR',
        description: '한국어 (대한민국)'
    }
};

// Aliases mapping (accepts names, codes, flag emojis)
const LANGUAGE_ALIASES = {
    'en': 'en', 'eng': 'en', 'english': 'en', '🇬🇧': 'en', '🇺🇸': 'en',
    'es': 'es', 'esp': 'es', 'espanol': 'es', 'español': 'es', 'spanish': 'es', '🇪🇸': 'es',
    'pt': 'pt', 'por': 'pt', 'portugues': 'pt', 'português': 'pt', 'portuguese': 'pt', '🇧🇷': 'pt', '🇵🇹': 'pt',
    'ja': 'ja', 'jp': 'ja', 'japanese': 'ja', 'nihongo': 'ja', '日本語': 'ja', '🇯🇵': 'ja',
    'hi': 'hi', 'hin': 'hi', 'hindi': 'hi', 'हिन्दी': 'hi', 'हिंदी': 'hi', '🇮🇳': 'hi',
    'fr': 'fr', 'fra': 'fr', 'french': 'fr', 'francais': 'fr', 'français': 'fr', '🇫🇷': 'fr',
    'de': 'de', 'ger': 'de', 'deu': 'de', 'german': 'de', 'deutsch': 'de', '🇩🇪': 'de',
    'ru': 'ru', 'rus': 'ru', 'russian': 'ru', 'русский': 'ru', '🇷🇺': 'ru',
    'id': 'id', 'ind': 'id', 'indonesian': 'id', 'bahasa': 'id', 'bahasa indonesia': 'id', '🇮🇩': 'id',
    'it': 'it', 'ita': 'it', 'italian': 'it', 'italiano': 'it', '🇮🇹': 'it',
    'vi': 'vi', 'vie': 'vi', 'vietnamese': 'vi', 'tieng viet': 'vi', 'tiếng việt': 'vi', '🇻🇳': 'vi',
    'tr': 'tr', 'tur': 'tr', 'turkish': 'tr', 'turkce': 'tr', 'türkçe': 'tr', '🇹🇷': 'tr',
    'ar': 'ar', 'ara': 'ar', 'arabic': 'ar', 'العربية': 'ar', '🇸🇦': 'ar',
    'ko': 'ko', 'kor': 'ko', 'korean': 'ko', 'hangul': 'ko', '한국어': 'ko', '🇰🇷': 'ko'
};

function resolveLanguageCode(input) {
    if (!input || typeof input !== 'string') return null;
    const clean = input.trim().toLowerCase();
    return LANGUAGE_ALIASES[clean] || (SUPPORTED_LANGUAGES[clean] ? clean : null);
}

// 2. High-Performance In-Memory Cache for 0ms synchronous lookups
const guildLanguageCache = new Map();

// 3. Translation Dictionaries for All 14 Languages
const TRANSLATIONS = {
    // 🇬🇧 ENGLISH (Default)
    en: {
        'setup.welcome_title': '🌟 Welcome to Starry!',
        'setup.welcome_desc': 'Thank you for adding **Starry** to **{guild}**!\n\nTo ensure the best experience for your community, please select your server language and run the setup wizard below.\n\n🌐 **Step 1:** Select your server\'s language from the dropdown.\n🧠 **Step 2:** Click **Sync & Setup** to automatically link channels, security, and economy.',
        'setup.select_lang_title': '🌐 Select Server Language',
        'setup.select_lang_desc': 'Choose the primary language for Starry commands, setup wizards, and automatic responses.',
        'setup.select_lang_placeholder': 'Choose your server language...',
        'setup.sync_title': '🧠 Starry Master Configuration Engine',
        'setup.sync_desc': '**Initiate Global Server Sync?**\n\nMy brain will scan your channels and automatically configure:\n🛡️ **Security:** Verification & Logs\n👋 **Community:** Welcomes, Starboard & Suggestions\n🎫 **Support:** Tickets, Appeals & Applications\n🎁 **Economy:** Loot Chests & Boosts\n\n*This will wire internal systems directly into your server layout.*',
        'setup.btn_sync': 'SYNC SERVER',
        'setup.btn_cancel': 'CANCEL',
        'setup.btn_lang': 'CHANGE LANGUAGE',
        'setup.btn_setup': 'START SETUP',
        'setup.scanning': '🧠 **SCANNING NEURAL NETWORK (CHANNELS)...**',
        'setup.complete_title': '✅ Neural Sync Complete',
        'setup.complete_desc': 'I have successfully scanned the server, identified channel purposes, and linked all systems!',
        'setup.aborted': '🚫 Master sync aborted.',
        'setup.timeout': '⚠️ Command timed out or encountered an error. Setup aborted.',
        'setup.lang_updated_title': '✅ Server Language Configured',
        'setup.lang_updated_desc': 'The server language has been successfully set to **{lang}** {flag}!\nYou can now proceed with the server setup.',
        'lang.current': 'ℹ️ Current server language is: **{lang}** ({code}) {flag}',
        'lang.change_hint': '*To change it, use `{prefix}setlanguage <code/name>` or select an option from the menu below.*',
        'lang.updated_title': '✅ Language Updated',
        'lang.updated_desc': 'Server language successfully switched to **{lang}** {flag}!\nAll automated responses and setup wizards will now be presented in {native}.',
        'lang.invalid': '❌ Invalid language selection. Please choose a valid language from the list below.',
        'lang.no_permission': '❌ **Access Denied:** You need the **Manage Server** or **Administrator** permission to change server language.',
        'common.access_denied': '❌ **Access Denied:** Only Administrators can execute this action.',
        'common.server_only': '❌ This command can only be used inside a Discord server.',
        'common.success': 'Success',
        'common.error': 'Error'
    },

    // 🇪🇸 SPANISH (Español)
    es: {
        'setup.welcome_title': '🌟 ¡Bienvenido a Starry!',
        'setup.welcome_desc': '¡Gracias por añadir a **Starry** a **{guild}**!\n\nPara garantizar la mejor experiencia para tu comunidad, selecciona el idioma del servidor e inicia la configuración a continuación.\n\n🌐 **Paso 1:** Selecciona el idioma de tu servidor en el menú desplegable.\n🧠 **Paso 2:** Haz clic en **Sincronizar y Configurar** para vincular canales, seguridad y economía.',
        'setup.select_lang_title': '🌐 Seleccionar Idioma del Servidor',
        'setup.select_lang_desc': 'Elige el idioma principal para los comandos, configuraciones y respuestas automáticas de Starry.',
        'setup.select_lang_placeholder': 'Elige el idioma de tu servidor...',
        'setup.sync_title': '🧠 Motor de Configuración Maestro de Starry',
        'setup.sync_desc': '**¿Iniciar Sincronización Global del Servidor?**\n\nMi sistema escaneará tus canales y configurará automáticamente:\n🛡️ **Seguridad:** Verificación y Registros\n👋 **Comunidad:** Bienvenidas, Starboard y Sugerencias\n🎫 **Soporte:** Tickets, Apelaciones y Postulaciones\n🎁 **Economía:** Cofres de Botín y Boosts\n\n*Esto conectará los sistemas internos directamente con el diseño de tu servidor.*',
        'setup.btn_sync': 'SINCRONIZAR SERVIDOR',
        'setup.btn_cancel': 'CANCELAR',
        'setup.btn_lang': 'CAMBIAR IDIOMA',
        'setup.btn_setup': 'INICIAR CONFIGURACIÓN',
        'setup.scanning': '🧠 **ESCANEANDO RED NEURONAL (CANALES)...**',
        'setup.complete_title': '✅ Sincronización Neuronal Completada',
        'setup.complete_desc': '¡He escaneado con éxito el servidor, identificado el propósito de cada canal y vinculado todos los sistemas!',
        'setup.aborted': '🚫 Sincronización maestra cancelada.',
        'setup.timeout': '⚠️ El comando expiró o encontró un error. Configuración abortada.',
        'setup.lang_updated_title': '✅ Idioma del Servidor Configurado',
        'setup.lang_updated_desc': '¡El idioma del servidor se ha configurado con éxito en **{lang}** {flag}!\nAhora puedes proceder con la sincronización del servidor.',
        'lang.current': 'ℹ️ El idioma actual del servidor es: **{lang}** ({code}) {flag}',
        'lang.change_hint': '*Para cambiarlo, usa `{prefix}setlanguage <código/nombre>` o selecciona una opción del menú de abajo.*',
        'lang.updated_title': '✅ Idioma Actualizado',
        'lang.updated_desc': '¡El idioma del servidor se ha cambiado a **{lang}** {flag}!\nTodas las respuestas automáticas y asistentes ahora se mostrarán en {native}.',
        'lang.invalid': '❌ Selección de idioma inválida. Por favor elige un idioma válido del menú.',
        'lang.no_permission': '❌ **Acceso Denegado:** Necesitas el permiso de **Administrar Servidor** o **Administrador** para cambiar el idioma.',
        'common.access_denied': '❌ **Acceso Denegado:** Solo los Administradores pueden ejecutar esta acción.',
        'common.server_only': '❌ Este comando solo se puede usar dentro de un servidor de Discord.',
        'common.success': 'Éxito',
        'common.error': 'Error'
    },

    // 🇧🇷 PORTUGUESE (Português)
    pt: {
        'setup.welcome_title': '🌟 Bem-vindo ao Starry!',
        'setup.welcome_desc': 'Obrigado por adicionar o **Starry** ao **{guild}**!\n\nPara garantir a melhor experiência na sua comunidade, selecione o idioma do servidor e inicie o assistente de configuração abaixo.\n\n🌐 **Passo 1:** Escolha o idioma no menu suspenso.\n🧠 **Passo 2:** Clique em **Sincronizar Servidor** para mapear canais, segurança e economia.',
        'setup.select_lang_title': '🌐 Selecionar Idioma do Servidor',
        'setup.select_lang_desc': 'Escolha o idioma principal para os comandos, assistentes e respostas automáticas do Starry.',
        'setup.select_lang_placeholder': 'Escolha o idioma do servidor...',
        'setup.sync_title': '🧠 Motor de Configuração Mestre do Starry',
        'setup.sync_desc': '**Iniciar Sincronização Global do Servidor?**\n\nMeu sistema irá escanear seus canais e configurar automaticamente:\n🛡️ **Segurança:** Verificação e Logs\n👋 **Comunidade:** Boas-vindas, Starboard e Sugestões\n🎫 **Suporte:** Tickets, Apelações e Formulários\n🎁 **Economia:** Baús de Recompensa e Boosts\n\n*Isso conectará os sistemas internos diretamente à estrutura do seu servidor.*',
        'setup.btn_sync': 'SINCRONIZAR SERVIDOR',
        'setup.btn_cancel': 'CANCELAR',
        'setup.btn_lang': 'ALTERAR IDIOMA',
        'setup.btn_setup': 'INICIAR CONFIGURAÇÃO',
        'setup.scanning': '🧠 **ESCANEANDO REDE NEURAL (CANAIS)...**',
        'setup.complete_title': '✅ Sincronização Concluída',
        'setup.complete_desc': 'Escaneei o servidor com sucesso, identifiquei a função de cada canal e conectei todos os módulos!',
        'setup.aborted': '🚫 Sincronização cancelada.',
        'setup.timeout': '⚠️ Tempo limite esgotado. Configuração cancelada.',
        'setup.lang_updated_title': '✅ Idioma do Servidor Configurado',
        'setup.lang_updated_desc': 'O idioma do servidor foi definido para **{lang}** {flag}!\nVocê pode agora prosseguir com a configuração.',
        'lang.current': 'ℹ️ O idioma atual do servidor é: **{lang}** ({code}) {flag}',
        'lang.change_hint': '*Para alterar, use `{prefix}setlanguage <código/nome>` ou selecione no menu abaixo.*',
        'lang.updated_title': '✅ Idioma Atualizado',
        'lang.updated_desc': 'O idioma do servidor foi alterado para **{lang}** {flag}!\nTodas as respostas automáticas agora serão em {native}.',
        'lang.invalid': '❌ Idioma inválido. Escolha um idioma válido da lista abaixo.',
        'lang.no_permission': '❌ **Acesso Negado:** Você precisa de permissão de **Gerenciar Servidor** ou **Administrador** para alterar o idioma.',
        'common.access_denied': '❌ **Acesso Negado:** Apenas Administradores podem executar esta ação.',
        'common.server_only': '❌ Este comando só pode ser usado dentro de um servidor Discord.',
        'common.success': 'Sucesso',
        'common.error': 'Erro'
    },

    // 🇯🇵 JAPANESE (日本語)
    ja: {
        'setup.welcome_title': '🌟 Starryへようこそ！',
        'setup.welcome_desc': '**{guild}** に **Starry** を導入していただき、ありがとうございます！\n\nコミュニティで最高の体験を提供するために、サーバーの言語を選択してセットアップを開始してください。\n\n🌐 **ステップ 1:** ドロップダウンメニューから言語を選択します。\n🧠 **ステップ 2:** **サーバーを同期** をクリックして、チャンネルやセキュリティを自動設定します。',
        'setup.select_lang_title': '🌐 サーバー言語の選択',
        'setup.select_lang_desc': 'Starryのコマンド、セットアップウィザード、自動応答の主要言語を選択してください。',
        'setup.select_lang_placeholder': 'サーバーの言語を選択してください...',
        'setup.sync_title': '🧠 Starry マスター構成エンジン',
        'setup.sync_desc': '**グローバルサーバー同期を開始しますか？**\n\nチャンネルを自動スキャンし、以下を設定します：\n🛡️ **セキュリティ:** 認証＆ログ監視\n👋 **コミュニティ:** ようこそ、スターボード、提案\n🎫 **サポート:** チケット、異議申し立て、申請\n🎁 **経済:** 宝箱ドロップ＆ブースト追跡\n\n*サーバーの構造に合わせてシステムを自動連携します。*',
        'setup.btn_sync': 'サーバーを同期',
        'setup.btn_cancel': 'キャンセル',
        'setup.btn_lang': '言語を変更',
        'setup.btn_setup': '設定を開始',
        'setup.scanning': '🧠 **チャンネルネットワークをスキャン中...**',
        'setup.complete_title': '✅ 同期が完了しました',
        'setup.complete_desc': 'サーバーのスキャンが完了し、各チャンネルの役割を識別してシステムをリンクしました！',
        'setup.aborted': '🚫 マスター同期が中止されました。',
        'setup.timeout': '⚠️ タイムアウトまたはエラーが発生しました。設定を中止しました。',
        'setup.lang_updated_title': '✅ サーバー言語を設定しました',
        'setup.lang_updated_desc': 'サーバーの言語を **{lang}** {flag} に設定しました！\nこのままサーバー設定を続行できます。',
        'lang.current': 'ℹ️ 現在のサーバー言語: **{lang}** ({code}) {flag}',
        'lang.change_hint': '*変更するには `{prefix}setlanguage <コード/名前>` を入力するか、下のメニューから選択してください。*',
        'lang.updated_title': '✅ 言語を更新しました',
        'lang.updated_desc': 'サーバー言語が **{lang}** {flag} に変更されました！\n自動応答やウィザードは {native} で表示されます。',
        'lang.invalid': '❌ 無効な言語が選択されました。リストから有効な言語を選択してください。',
        'lang.no_permission': '❌ **アクセス拒否:** 言語を変更するには **サーバーの管理** または **管理者** 権限が必要です。',
        'common.access_denied': '❌ **アクセス拒否:** 管理者のみがこのアクションを実行できます。',
        'common.server_only': '❌ このコマンドはDiscordサーバー内でのみ使用できます。',
        'common.success': '成功',
        'common.error': 'エラー'
    },

    // 🇮🇳 HINDI (हिन्दी)
    hi: {
        'setup.welcome_title': '🌟 Starry में आपका स्वागत है!',
        'setup.welcome_desc': '**{guild}** में **Starry** जोड़ने के लिए धन्यवाद!\n\nअपने सर्वर के लिए बेहतरीन अनुभव सुनिश्चित करने के लिए, नीचे सर्वर की भाषा चुनें और सेटअप शुरू करें।\n\n🌐 **स्टेप 1:** ड्रॉपडाउन मेनू से अपने सर्वर की भाषा चुनें।\n🧠 **स्टेप 2:** चैनल्स, सुरक्षा और अर्थव्यवस्था को ऑटो-लिंक करने के लिए **सर्वर सिंक करें** पर क्लिक करें।',
        'setup.select_lang_title': '🌐 सर्वर की भाषा चुनें',
        'setup.select_lang_desc': 'Starry कमांड्स, सेटअप और स्वचालित संदेशों के लिए प्राथमिक भाषा चुनें।',
        'setup.select_lang_placeholder': 'सर्वर की भाषा चुनें...',
        'setup.sync_title': '🧠 Starry मास्टर कॉन्फ़िगरेशन इंजन',
        'setup.sync_desc': '**क्या आप ग्लोबल सर्वर सिंक शुरू करना चाहते हैं?**\n\nबॉट आपके चैनल्स को स्कैन करेगा और स्वचालित रूप से कॉन्फ़िगर करेगा:\n🛡️ **सुरक्षा:** वेरिफिकेशन और लॉग्स\n👋 **कम्युनिटी:** वेलकम, स्टारबोर्ड और सुझाव\n🎫 **सपोर्ट:** टिकट्स, अपील और आवेदन\n🎁 **इकॉनमी:** लूट चेस्ट्स और बूस्ट्स\n\n*यह बॉट के सभी सिस्टम्स को आपके सर्वर लेआउट से जोड़ देगा।*',
        'setup.btn_sync': 'सर्वर सिंक करें',
        'setup.btn_cancel': 'रद्द करें',
        'setup.btn_lang': 'भाषा बदलें',
        'setup.btn_setup': 'सेटअप शुरू करें',
        'setup.scanning': '🧠 **चैनल्स को स्कैन किया जा रहा है...**',
        'setup.complete_title': '✅ न्यूरल सिंक पूरा हुआ',
        'setup.complete_desc': 'मैंने सफलतापूर्वक सर्वर को स्कैन कर लिया है और सभी सिस्टम्स को लिंक कर दिया है!',
        'setup.aborted': '🚫 मास्टर सिंक रद्द कर दिया गया।',
        'setup.timeout': '⚠️ कमांड का समय समाप्त हो गया। सेटअप रद्द किया गया।',
        'setup.lang_updated_title': '✅ सर्वर भाषा सेट हो गई',
        'setup.lang_updated_desc': 'सर्वर भाषा सफलतापूर्वक **{lang}** {flag} पर सेट कर दी गई है!\nअब आप सर्वर सेटअप जारी रख सकते हैं।',
        'lang.current': 'ℹ️ वर्तमान सर्वर भाषा है: **{lang}** ({code}) {flag}',
        'lang.change_hint': '*बदलने के लिए `{prefix}setlanguage <कोड/नाम>` का उपयोग करें या नीचे दिए गए मेनू से चुनें।*',
        'lang.updated_title': '✅ भाषा अपडेट हो गई',
        'lang.updated_desc': 'सर्वर भाषा बदलकर **{lang}** {flag} कर दी गई है!\nअब बॉट के संदेश {native} में दिखाई देंगे।',
        'lang.invalid': '❌ अमान्य भाषा चयन। कृपया नीचे दी गई सूची में से एक मान्य भाषा चुनें।',
        'lang.no_permission': '❌ **अनुमति अस्वीकृत:** भाषा बदलने के लिए आपके पास **Manage Server** या **Administrator** की अनुमति होनी चाहिए।',
        'common.access_denied': '❌ **अनुमति अस्वीकृत:** केवल एडमिनिस्ट्रेटर ही यह कार्रवाई कर सकते हैं।',
        'common.server_only': '❌ यह कमांड केवल डिस्कॉर्ड सर्वर के अंदर उपयोग किया जा सकता है।',
        'common.success': 'सफल',
        'common.error': 'त्रुटि'
    },

    // 🇫🇷 FRENCH (Français)
    fr: {
        'setup.welcome_title': '🌟 Bienvenue sur Starry !',
        'setup.welcome_desc': 'Merci d\'avoir ajouté **Starry** à **{guild}** !\n\nPour offrir la meilleure expérience à votre communauté, veuillez sélectionner la langue du serveur et lancer l\'assistant de configuration ci-dessous.\n\n🌐 **Étape 1 :** Sélectionnez la langue dans le menu déroulant.\n🧠 **Étape 2 :** Cliquez sur **Synchroniser le Serveur** pour configurer vos canaux automatiquement.',
        'setup.select_lang_title': '🌐 Choisir la Langue du Serveur',
        'setup.select_lang_desc': 'Choisissez la langue principale pour les commandes, configurations et réponses automatiques de Starry.',
        'setup.select_lang_placeholder': 'Choisissez la langue du serveur...',
        'setup.sync_title': '🧠 Moteur de Configuration Maître de Starry',
        'setup.sync_desc': '**Lancer la synchronisation globale du serveur ?**\n\nLe système scannera vos canaux et configurera automatiquement :\n🛡️ **Sécurité :** Vérification & Journaux\n👋 **Communauté :** Bienvenues, Starboard & Suggestions\n🎫 **Support :** Tickets & Candidatures\n🎁 **Économie :** Coffres de Butin & Boosts',
        'setup.btn_sync': 'SYNCHRONISER LE SERVEUR',
        'setup.btn_cancel': 'ANNULER',
        'setup.btn_lang': 'CHANGER DE LANGUE',
        'setup.btn_setup': 'DÉMARRER LA CONFIGURATION',
        'setup.scanning': '🧠 **SCAN DES CANAUX EN COURS...**',
        'setup.complete_title': '✅ Synchronisation Réussie',
        'setup.complete_desc': 'J\'ai scanné le serveur avec succès et lié tous les systèmes aux canaux correspondants !',
        'setup.aborted': '🚫 Synchronisation annulée.',
        'setup.timeout': '⚠️ Délai expiré. Configuration annulée.',
        'setup.lang_updated_title': '✅ Langue du Serveur Configurée',
        'setup.lang_updated_desc': 'La langue du serveur a été configurée sur **{lang}** {flag} !\nVous pouvez maintenant procéder à la configuration.',
        'lang.current': 'ℹ️ La langue actuelle du serveur est : **{lang}** ({code}) {flag}',
        'lang.change_hint': '*Pour la changer, utilisez `{prefix}setlanguage <code/nom>` ou le menu ci-dessous.*',
        'lang.updated_title': '✅ Langue Mise à Jour',
        'lang.updated_desc': 'La langue du serveur est désormais **{lang}** {flag} !\nToutes les réponses automatiques seront en {native}.',
        'lang.invalid': '❌ Choix de langue invalide.',
        'lang.no_permission': '❌ **Accès Refusé :** Vous avez besoin de la permission **Gérer le serveur** ou **Administrateur**.',
        'common.access_denied': '❌ **Accès Refusé :** Seuls les Administrateurs peuvent effectuer cette action.',
        'common.server_only': '❌ Cette commande ne peut être utilisée que dans un serveur Discord.',
        'common.success': 'Succès',
        'common.error': 'Erreur'
    },

    // 🇩🇪 GERMAN (Deutsch)
    de: {
        'setup.welcome_title': '🌟 Willkommen bei Starry!',
        'setup.welcome_desc': 'Vielen Dank, dass du **Starry** zu **{guild}** hinzugefügt hast!\n\nWähle bitte die Sprache des Servers und starte den Einrichtungsassistenten unten.\n\n🌐 **Schritt 1:** Wähle deine Serversprache aus dem Menü.\n🧠 **Schritt 2:** Klicke auf **Server Synchronisieren**, um Kanäle und Sicherheit automatisch zu verknüpfen.',
        'setup.select_lang_title': '🌐 Serversprache Auswählen',
        'setup.select_lang_desc': 'Wähle die Hauptsprache für Starry-Befehle und automatische Antworten.',
        'setup.select_lang_placeholder': 'Serversprache auswählen...',
        'setup.sync_title': '🧠 Starry Master Konfigurations-Engine',
        'setup.sync_desc': '**Globale Server-Synchronisierung starten?**\n\nDas System scannt deine Kanäle und konfiguriert automatisch:\n🛡️ **Sicherheit:** Verifizierung & Logs\n👋 **Community:** Willkommen, Starboard & Vorschläge\n🎫 **Support:** Tickets & Bewerbungen\n🎁 **Wirtschaft:** Beutetruhen & Boosts',
        'setup.btn_sync': 'SERVER SYNCHRONISIEREN',
        'setup.btn_cancel': 'ABBRECHEN',
        'setup.btn_lang': 'SPRACHE ÄNDERN',
        'setup.btn_setup': 'EINRICHTUNG STARTEN',
        'setup.scanning': '🧠 **KANÄLE WERDEN GESCANNT...**',
        'setup.complete_title': '✅ Synchronisierung Abgeschlossen',
        'setup.complete_desc': 'Der Server wurde erfolgreich gescannt und alle Systeme wurden verknüpft!',
        'setup.aborted': '🚫 Synchronisierung abgebrochen.',
        'setup.timeout': '⚠️ Zeitüberschreitung. Einrichtung abgebrochen.',
        'setup.lang_updated_title': '✅ Serversprache Gespeichert',
        'setup.lang_updated_desc': 'Serversprache wurde erfolgreich auf **{lang}** {flag} eingestellt!',
        'lang.current': 'ℹ️ Aktuelle Serversprache ist: **{lang}** ({code}) {flag}',
        'lang.change_hint': '*Zum Ändern nutze `{prefix}setlanguage <Code/Name>` oder das Menü unten.*',
        'lang.updated_title': '✅ Sprache Aktualisiert',
        'lang.updated_desc': 'Die Serversprache wurde auf **{lang}** {flag} umgestellt!\nAntworten erfolgen nun auf {native}.',
        'lang.invalid': '❌ Ungültige Sprachauswahl.',
        'lang.no_permission': '❌ **Zugriff Verweigert:** Du benötigst die Berechtigung **Server verwalten** oder **Administrator**.',
        'common.access_denied': '❌ **Zugriff Verweigert:** Nur Administratoren können diese Aktion ausführen.',
        'common.server_only': '❌ Dieser Befehl kann nur auf einem Discord-Server verwendet werden.',
        'common.success': 'Erfolg',
        'common.error': 'Fehler'
    },

    // 🇷🇺 RUSSIAN (Русский)
    ru: {
        'setup.welcome_title': '🌟 Добро пожаловать в Starry!',
        'setup.welcome_desc': 'Спасибо за добавление **Starry** на сервер **{guild}**!\n\nПожалуйста, выберите язык сервера и запустите мастер первоначальной настройки ниже.\n\n🌐 **Шаг 1:** Выберите язык сервера из выпадающего списка.\n🧠 **Шаг 2:** Нажмите **Синхронизировать**, чтобы автоматически связать каналы и модули.',
        'setup.select_lang_title': '🌐 Выбор Языка Сервера',
        'setup.select_lang_desc': 'Выберите основной язык для команд, настроек и системных сообщений Starry.',
        'setup.select_lang_placeholder': 'Выберите язык сервера...',
        'setup.sync_title': '🧠 Главный Движок Настройки Starry',
        'setup.sync_desc': '**Запустить глобальную синхронизацию сервера?**\n\nБот просканирует каналы и автоматически настроит:\n🛡️ **Безопасность:** Верификация и Журналы\n👋 **Сообщество:** Приветствия, Starboard и Идеи\n🎫 **Поддержка:** Тикеты и Заявки\n🎁 **Экономика:** Сундуки и Отслеживание Бустов',
        'setup.btn_sync': 'СИНХРОНИЗИРОВАТЬ',
        'setup.btn_cancel': 'ОТМЕНА',
        'setup.btn_lang': 'ИЗМЕНИТЬ ЯЗЫК',
        'setup.btn_setup': 'НАЧАТЬ НАСТРОЙКУ',
        'setup.scanning': '🧠 **СКАНИРОВАНИЕ КАНАЛОВ...**',
        'setup.complete_title': '✅ Синхронизация Завершена',
        'setup.complete_desc': 'Сервер успешно просканирован, назначения каналов определены и системы подключены!',
        'setup.aborted': '🚫 Синхронизация отменена.',
        'setup.timeout': '⚠️ Время ожидания истекло. Настройка отменена.',
        'setup.lang_updated_title': '✅ Язык Сервера Установлен',
        'setup.lang_updated_desc': 'Язык сервера успешно установлен на **{lang}** {flag}!\nТеперь вы можете продолжить настройку.',
        'lang.current': 'ℹ️ Текущий язык сервера: **{lang}** ({code}) {flag}',
        'lang.change_hint': '*Чтобы изменить, введите `{prefix}setlanguage <код/название>` или выберите в меню ниже.*',
        'lang.updated_title': '✅ Язык Обновлен',
        'lang.updated_desc': 'Язык сервера успешно переключен на **{lang}** {flag}!\nВсе системные сообщения будут на {native}.',
        'lang.invalid': '❌ Недопустимый выбор языка.',
        'lang.no_permission': '❌ **Доступ Запрещен:** Требуются права **Управление сервером** или **Администратор**.',
        'common.access_denied': '❌ **Доступ Запрещен:** Только Администраторы могут выполнять это действие.',
        'common.server_only': '❌ Эту команду можно использовать только внутри сервера Discord.',
        'common.success': 'Успешно',
        'common.error': 'Ошибка'
    },

    // 🇮🇩 INDONESIAN (Bahasa Indonesia)
    id: {
        'setup.welcome_title': '🌟 Selamat Datang di Starry!',
        'setup.welcome_desc': 'Terima kasih telah menambahkan **Starry** ke **{guild}**!\n\nPilih bahasa server Anda dan jalankan panduan pengaturan di bawah ini.\n\n🌐 **Langkah 1:** Pilih bahasa server dari menu dropdown.\n🧠 **Langkah 2:** Klik **Sinkronkan Server** untuk menghubungkan channel, keamanan, dan ekonomi secara otomatis.',
        'setup.select_lang_title': '🌐 Pilih Bahasa Server',
        'setup.select_lang_desc': 'Pilih bahasa utama untuk perintah, wizard pengaturan, dan respons otomatis Starry.',
        'setup.select_lang_placeholder': 'Pilih bahasa server Anda...',
        'setup.sync_title': '🧠 Mesin Konfigurasi Utama Starry',
        'setup.sync_desc': '**Mulai Sinkronisasi Server Global?**\n\nSistem akan memindai channel dan mengonfigurasi otomatis:\n🛡️ **Keamanan:** Verifikasi & Log\n👋 **Komunitas:** Sambutan, Starboard & Saran\n🎫 **Dukungan:** Tiket, Banding & Lamaran\n🎁 **Ekonomi:** Peti Hadiah & Pelacak Boost',
        'setup.btn_sync': 'SINKRONKAN SERVER',
        'setup.btn_cancel': 'BATAL',
        'setup.btn_lang': 'GANTI BAHASA',
        'setup.btn_setup': 'MULAI PENGATURAN',
        'setup.scanning': '🧠 **MEMINDAI SALURAN SERVER...**',
        'setup.complete_title': '✅ Sinkronisasi Selesai',
        'setup.complete_desc': 'Berhasil memindai server, mengenali fungsi channel, dan menghubungkan seluruh sistem!',
        'setup.aborted': '🚫 Sinkronisasi dibatalkan.',
        'setup.timeout': '⚠️ Waktu habis. Pengaturan dibatalkan.',
        'setup.lang_updated_title': '✅ Bahasa Server Ditetapkan',
        'setup.lang_updated_desc': 'Bahasa server berhasil diatur ke **{lang}** {flag}!',
        'lang.current': 'ℹ️ Bahasa server saat ini: **{lang}** ({code}) {flag}',
        'lang.change_hint': '*Gunakan `{prefix}setlanguage <kode/nama>` atau menu di bawah untuk mengubahnya.*',
        'lang.updated_title': '✅ Bahasa Diperbarui',
        'lang.updated_desc': 'Bahasa server telah diubah ke **{lang}** {flag}!\nSemua respons sekarang dalam {native}.',
        'lang.invalid': '❌ Pilihan bahasa tidak valid.',
        'lang.no_permission': '❌ **Akses Ditolak:** Anda membutuhkan izin **Kelola Server** atau **Administrator**.',
        'common.access_denied': '❌ **Akses Ditolak:** Hanya Administrator yang dapat menjalankan aksi ini.',
        'common.server_only': '❌ Perintah ini hanya dapat digunakan di dalam server Discord.',
        'common.success': 'Berhasil',
        'common.error': 'Kesalahan'
    },

    // 🇮🇹 ITALIAN (Italiano)
    it: {
        'setup.welcome_title': '🌟 Benvenuto su Starry!',
        'setup.welcome_desc': 'Grazie per aver aggiunto **Starry** a **{guild}**!\n\nSeleziona la lingua del server e avvia la configurazione qui sotto.\n\n🌐 **Passo 1:** Scegli la lingua dal menu a tendina.\n🧠 **Passo 2:** Clicca su **Sincronizza Server** per collegare automaticamente canali e sicurezza.',
        'setup.select_lang_title': '🌐 Seleziona Lingua Server',
        'setup.select_lang_desc': 'Scegli la lingua principale per i comandi, le configurazioni e le risposte di Starry.',
        'setup.select_lang_placeholder': 'Scegli la lingua del tuo server...',
        'setup.sync_title': '🧠 Motore di Configurazione Starry',
        'setup.sync_desc': '**Avviare la sincronizzazione globale del server?**\n\nIl sistema analizzerà i canali e configurerà automaticamente:\n🛡️ **Sicurezza:** Verifica e Log\n👋 **Community:** Benvenuti, Starboard e Suggerimenti\n🎫 **Supporto:** Ticket e Candidature\n🎁 **Economia:** Casse e Boost',
        'setup.btn_sync': 'SINCRONIZZA SERVER',
        'setup.btn_cancel': 'ANNULLA',
        'setup.btn_lang': 'CAMBIA LINGUA',
        'setup.btn_setup': 'INIZIA CONFIGURAZIONE',
        'setup.scanning': '🧠 **SCANSIONE DEI CANALI IN CORSO...**',
        'setup.complete_title': '✅ Sincronizzazione Completata',
        'setup.complete_desc': 'Server analizzato con successo e sistemi collegati correttamente!',
        'setup.aborted': '🚫 Sincronizzazione annullata.',
        'setup.timeout': '⚠️ Timeout scaduto. Configurazione annullata.',
        'setup.lang_updated_title': '✅ Lingua del Server Impostata',
        'setup.lang_updated_desc': 'La lingua del server è stata impostata su **{lang}** {flag}!',
        'lang.current': 'ℹ️ La lingua attuale del server è: **{lang}** ({code}) {flag}',
        'lang.change_hint': '*Per cambiarla, usa `{prefix}setlanguage <codice/nome>` o il menu sottostante.*',
        'lang.updated_title': '✅ Lingua Aggiornata',
        'lang.updated_desc': 'La lingua del server è stata cambiata in **{lang}** {flag}!\nI messaggi automatici saranno in {native}.',
        'lang.invalid': '❌ Lingua non valida.',
        'lang.no_permission': '❌ **Accesso Negato:** Devi disporre dell\'autorizzazione **Gestisci server** o **Amministratore**.',
        'common.access_denied': '❌ **Accesso Negato:** Solo gli Amministratori possono eseguire questa azione.',
        'common.server_only': '❌ Questo comando può essere utilizzato solo all\'interno di un server Discord.',
        'common.success': 'Successo',
        'common.error': 'Errore'
    },

    // 🇻🇳 VIETNAMESE (Tiếng Việt)
    vi: {
        'setup.welcome_title': '🌟 Chào mừng đến với Starry!',
        'setup.welcome_desc': 'Cảm ơn bạn đã thêm **Starry** vào **{guild}**!\n\nVui lòng chọn ngôn ngữ máy chủ và bắt đầu cài đặt bên dưới.\n\n🌐 **Bước 1:** Chọn ngôn ngữ máy chủ từ danh sách.\n🧠 **Bước 2:** Nhấn **Đồng bộ máy chủ** để tự động kết nối các kênh và hệ thống.',
        'setup.select_lang_title': '🌐 Chọn Ngôn Ngữ Máy Chủ',
        'setup.select_lang_desc': 'Chọn ngôn ngữ chính cho lệnh, trình hướng dẫn và phản hồi tự động của Starry.',
        'setup.select_lang_placeholder': 'Chọn ngôn ngữ máy chủ...',
        'setup.sync_title': '🧠 Bộ Cấu Hình Tự Động Starry',
        'setup.sync_desc': '**Bắt đầu đồng bộ hóa máy chủ toàn diện?**\n\nStarry sẽ quét các kênh và cấu hình tự động:\n🛡️ **Bảo mật:** Xác minh & Nhật ký (Logs)\n👋 **Cộng đồng:** Lời chào, Starboard & Gợi ý\n🎫 **Hỗ trợ:** Vé (Tickets) & Đơn ứng tuyển\n🎁 **Kinh tế:** Rương kho báu & Theo dõi Boost',
        'setup.btn_sync': 'ĐỒNG BỘ MÁY CHỦ',
        'setup.btn_cancel': 'HỦY BỎ',
        'setup.btn_lang': 'ĐỔI NGÔN NGỮ',
        'setup.btn_setup': 'BẮT ĐẦU CÀI ĐẶT',
        'setup.scanning': '🧠 **ĐANG QUÉT MẠNG LƯỚI KÊNH...**',
        'setup.complete_title': '✅ Đồng Bộ Hoàn Tất',
        'setup.complete_desc': 'Đã quét máy chủ thành công, xác định mục đích các kênh và liên kết toàn bộ hệ thống!',
        'setup.aborted': '🚫 Đã hủy đồng bộ.',
        'setup.timeout': '⚠️ Hết thời gian chờ. Đã hủy cài đặt.',
        'setup.lang_updated_title': '✅ Đã Cài Đặt Ngôn Ngữ',
        'setup.lang_updated_desc': 'Ngôn ngữ máy chủ đã được đổi sang **{lang}** {flag}!',
        'lang.current': 'ℹ️ Ngôn ngữ máy chủ hiện tại: **{lang}** ({code}) {flag}',
        'lang.change_hint': '*Dùng lệnh `{prefix}setlanguage <mã/tên>` hoặc chọn từ menu bên dưới để đổi.*',
        'lang.updated_title': '✅ Đã Cập Nhật Ngôn Ngữ',
        'lang.updated_desc': 'Ngôn ngữ máy chủ đã đổi sang **{lang}** {flag}!\nTất cả phản hồi sẽ hiển thị bằng {native}.',
        'lang.invalid': '❌ Ngôn ngữ không hợp lệ.',
        'lang.no_permission': '❌ **Truy Cập Bị Từ Chối:** Bạn cần quyền **Quản lý máy chủ** hoặc **Quản trị viên**.',
        'common.access_denied': '❌ **Từ Chối:** Chỉ Quản trị viên mới có thể thực hiện thao tác này.',
        'common.server_only': '❌ Lệnh này chỉ có thể sử dụng trong máy chủ Discord.',
        'common.success': 'Thành công',
        'common.error': 'Lỗi'
    },

    // 🇹🇷 TURKISH (Türkçe)
    tr: {
        'setup.welcome_title': '🌟 Starry\'ye Hoş Geldiniz!',
        'setup.welcome_desc': '**Starry**\'yi **{guild}** sunucusuna eklediğiniz için teşekkür ederiz!\n\nLütfen sunucu dilini seçin ve kurulum sihirbazını başlatın.\n\n🌐 **Adım 1:** Açılır menüden sunucu dilinizi seçin.\n🧠 **Adım 2:** Kanalları ve güvenliği bağlamak için **Sunucuyu Senkronize Et** butonuna tıklayın.',
        'setup.select_lang_title': '🌐 Sunucu Dilini Seçin',
        'setup.select_lang_desc': 'Komutlar ve otomatik yanıtlar için birincil sunucu dilini seçin.',
        'setup.select_lang_placeholder': 'Sunucu dilinizi seçin...',
        'setup.sync_title': '🧠 Starry Ana Yapılandırma Motoru',
        'setup.sync_desc': '**Küresel Sunucu Senkronizasyonu Başlatılsın mı?**\n\nSistem kanalları tarayacak ve otomatik olarak ayarlayacaktır:\n🛡️ **Güvenlik:** Doğrulama & Günlükler\n👋 **Topluluk:** Karşılama, Starboard & Öneriler\n🎫 **Destek:** Destek Talepleri & Başvurular\n🎁 **Ekonomi:** Sandıklar & Takviye Takibi',
        'setup.btn_sync': 'SUNUCUYU SENKRONİZE ET',
        'setup.btn_cancel': 'İPTAL',
        'setup.btn_lang': 'DİLİ DEĞİŞTİR',
        'setup.btn_setup': 'KURULUMU BAŞLAT',
        'setup.scanning': '🧠 **KANALLAR TARANIYOR...**',
        'setup.complete_title': '✅ Senkronizasyon Tamamlandı',
        'setup.complete_desc': 'Sunucu başarıyla tarandı ve sistemler eşleştirildi!',
        'setup.aborted': '🚫 Senkronizasyon iptal edildi.',
        'setup.timeout': '⚠️ Zaman aşımı. Kurulum iptal edildi.',
        'setup.lang_updated_title': '✅ Sunucu Dili Ayarlandı',
        'setup.lang_updated_desc': 'Sunucu dili başarıyla **{lang}** {flag} olarak ayarlandı!',
        'lang.current': 'ℹ️ Geçerli sunucu dili: **{lang}** ({code}) {flag}',
        'lang.change_hint': '*Değiştirmek için `{prefix}setlanguage <kod/ad>` kullanın veya menüden seçin.*',
        'lang.updated_title': '✅ Dil Güncellendi',
        'lang.updated_desc': 'Sunucu dili **{lang}** {flag} olarak değiştirildi!\nMesajlar artık {native} dilinde gösterilecek.',
        'lang.invalid': '❌ Geçersiz dil seçimi.',
        'lang.no_permission': '❌ **Erişim Reddedildi:** Dili değiştirmek için **Sunucuyu Yönet** veya **Yönetici** yetkisi gereklidir.',
        'common.access_denied': '❌ **Erişim Reddedildi:** Yalnızca Yöneticiler bu işlemi yapabilir.',
        'common.server_only': '❌ Bu komut yalnızca Discord sunucularında kullanılabilir.',
        'common.success': 'Başarılı',
        'common.error': 'Hata'
    },

    // 🇸🇦 ARABIC (العربية)
    ar: {
        'setup.welcome_title': '🌟 مرحبًا بك في Starry!',
        'setup.welcome_desc': 'شكرًا لإضافة **Starry** إلى **{guild}**!\n\nلضمان أفضل تجربة لمجتمعك، يرجى اختيار لغة السيرفر وبدء الإعداد أدناه.\n\n🌐 **الخطوة 1:** اختر لغة السيرفر من القائمة أدناه.\n🧠 **الخطوة 2:** انقر فوق **مزامنة السيرفر** لربط القنوات والأمان والاقتصاد تلقائيًا.',
        'setup.select_lang_title': '🌐 اختيار لغة السيرفر',
        'setup.select_lang_desc': 'اختر اللغة الأساسية لأوامر Starry وإعداداته والردود التلقائية.',
        'setup.select_lang_placeholder': 'اختر لغة السيرفر...',
        'setup.sync_title': '🧠 محرك إعدادات Starry الرئيسي',
        'setup.sync_desc': '**بدء المزامنة الشاملة للسيرفر؟**\n\nسيقوم البوت بمسح قنواتك وتهيئة الآتي تلقائيًا:\n🛡️ **الأمان:** التحقق وسجلات المراقبة\n👋 **المجتمع:** الترحيب، لوحة النجوم والاقتراحات\n🎫 **الدعم:** التذاكر والتقديمات\n🎁 **الاقتصاد:** صناديق المكافآت ومتتبع البوست',
        'setup.btn_sync': 'مزامنة السيرفر',
        'setup.btn_cancel': 'إلغاء',
        'setup.btn_lang': 'تغيير اللغة',
        'setup.btn_setup': 'بدء الإعداد',
        'setup.scanning': '🧠 **جاري مسح القنوات وتوصيل الأنظمة...**',
        'setup.complete_title': '✅ تمت المزامنة بنجاح',
        'setup.complete_desc': 'تم مسح السيرفر بنجاح وربط جميع الأنظمة بالقنوات المخصصة لها!',
        'setup.aborted': '🚫 تم إلغاء المزامنة.',
        'setup.timeout': '⚠️ انتهت المهلة أو حدث خطأ. تم إلغاء الإعداد.',
        'setup.lang_updated_title': '✅ تم تعيين لغة السيرفر',
        'setup.lang_updated_desc': 'تم ضبط لغة السيرفر بنجاح على **{lang}** {flag}!\nيمكنك الآن المتابعة في إعداد السيرفر.',
        'lang.current': 'ℹ️ لغة السيرفر الحالية هي: **{lang}** ({code}) {flag}',
        'lang.change_hint': '*لتغييرها، استخدم `{prefix}setlanguage <الرمز/الاسم>` أو اختر من القائمة أدناه.*',
        'lang.updated_title': '✅ تم تحديث اللغة',
        'lang.updated_desc': 'تم تغيير لغة السيرفر إلى **{lang}** {flag}!\nستظهر الآن جميع الردود باللغة {native}.',
        'lang.invalid': '❌ اختيار غير صالح للغة.',
        'lang.no_permission': '❌ **تم رفض الوصول:** تحتاج إلى صلاحية **إدارة السيرفر** أو **مسؤول** لتغيير اللغة.',
        'common.access_denied': '❌ **تم رفض الوصول:** المسؤولون فقط هم من يمكنهم تنفيذ هذا الإجراء.',
        'common.server_only': '❌ لا يمكن استخدام هذا الأمر إلا داخل سيرفر ديسكورد.',
        'common.success': 'نجاح',
        'common.error': 'خطأ'
    },

    // 🇰🇷 KOREAN (한국어)
    ko: {
        'setup.welcome_title': '🌟 Starry에 오신 것을 환영합니다!',
        'setup.welcome_desc': '**{guild}** 서버에 **Starry**를 추가해 주셔서 감사합니다!\n\n커뮤니티를 위한 최상의 경험을 위해 서버 언어를 선택하고 설정 마법사를 시작하세요.\n\n🌐 **1단계:** 드롭다운 메뉴에서 서버 언어를 선택합니다.\n🧠 **2단계:** **서버 동기화**를 클릭하여 채널, 보안 및 경제 시스템을 자동으로 연결합니다.',
        'setup.select_lang_title': '🌐 서버 언어 선택',
        'setup.select_lang_desc': 'Starry 명령어, 설정 마법사 및 자동 응답에 사용할 기본 언어를 선택하세요.',
        'setup.select_lang_placeholder': '서버 언어를 선택하세요...',
        'setup.sync_title': '🧠 Starry 마스터 구성 엔진',
        'setup.sync_desc': '**글로벌 서버 동기화를 시작하시겠습니까?**\n\n채널을 자동으로 스캔하여 다음 항목을 설정합니다:\n🛡️ **보안:** 인증 및 로그 모니터링\n👋 **커뮤니티:** 환영 인사, 스타보드 및 제안\n🎫 **지원:** 티켓 및 신청서\n🎁 **경제:** 전리품 상자 및 부스트 추적',
        'setup.btn_sync': '서버 동기화',
        'setup.btn_cancel': '취소',
        'setup.btn_lang': '언어 변경',
        'setup.btn_setup': '설정 시작',
        'setup.scanning': '🧠 **채널 네트워크 스캔 중...**',
        'setup.complete_title': '✅ 동기화 완료',
        'setup.complete_desc': '서버 스캔을 완료하고 각 채널의 역할에 맞게 시스템을 성공적으로 연결했습니다!',
        'setup.aborted': '🚫 마스터 동기화가 취소되었습니다.',
        'setup.timeout': '⚠️ 시간이 초과되었습니다. 설정이 취소되었습니다.',
        'setup.lang_updated_title': '✅ 서버 언어 설정 완료',
        'setup.lang_updated_desc': '서버 언어가 **{lang}** {flag}로 성공적으로 설정되었습니다!\n이제 서버 설정을 계속 진행할 수 있습니다.',
        'lang.current': 'ℹ️ 현재 서버 언어: **{lang}** ({code}) {flag}',
        'lang.change_hint': '*변경하려면 `{prefix}setlanguage <코드/이름>`을 입력하거나 아래 메뉴에서 선택하세요.*',
        'lang.updated_title': '✅ 언어 변경 완료',
        'lang.updated_desc': '서버 언어가 **{lang}** {flag}로 변경되었습니다!\n이제 모든 자동 메시지가 {native}로 표시됩니다.',
        'lang.invalid': '❌ 유효하지 않은 언어입니다.',
        'lang.no_permission': '❌ **접근 거부:** 언어를 변경하려면 **서버 관리** 또는 **관리자** 권한이 필요합니다.',
        'common.access_denied': '❌ **접근 거부:** 관리자만 이 작업을 실행할 수 있습니다.',
        'common.server_only': '❌ 이 명령어는 디스코드 서버 내에서만 사용할 수 있습니다.',
        'common.success': '성공',
        'common.error': '오류'
    }
};

// 4. Core Query and Mutation API
async function getGuildLanguage(guildId) {
    if (!guildId) return 'en';
    if (guildLanguageCache.has(guildId)) {
        return guildLanguageCache.get(guildId);
    }

    try {
        const mongoose = require('mongoose');
        if (!mongoose.connection || mongoose.connection.readyState !== 1) {
            guildLanguageCache.set(guildId, 'en');
            return 'en';
        }

        const ServerSettings = require('../models/ServerSettings');
        const doc = await Promise.race([
            ServerSettings.findOne({ guildId }).select('language').lean(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1000))
        ]);

        const lang = (doc && doc.language && SUPPORTED_LANGUAGES[doc.language]) ? doc.language : 'en';
        guildLanguageCache.set(guildId, lang);
        return lang;
    } catch (e) {
        guildLanguageCache.set(guildId, 'en');
        return 'en';
    }
}

function getGuildLanguageSync(guildId) {
    if (!guildId) return 'en';
    return guildLanguageCache.get(guildId) || 'en';
}

async function setGuildLanguage(guildId, langCode) {
    if (!guildId) return 'en';
    const cleanCode = resolveLanguageCode(langCode) || 'en';
    guildLanguageCache.set(guildId, cleanCode);

    try {
        const ServerSettings = require('../models/ServerSettings');
        await ServerSettings.findOneAndUpdate(
            { guildId },
            { $set: { language: cleanCode } },
            { upsert: true, new: true }
        );
    } catch (e) {
        console.error(`[i18n] Error persisting language for guild ${guildId}:`, e.message);
    }

    return cleanCode;
}

// 5. String Interpolation Translation Function
function t(guildOrLang, key, params = {}) {
    let lang = 'en';

    if (typeof guildOrLang === 'string') {
        if (SUPPORTED_LANGUAGES[guildOrLang]) {
            lang = guildOrLang;
        } else {
            // It might be a guildId
            lang = getGuildLanguageSync(guildOrLang);
        }
    } else if (guildOrLang && typeof guildOrLang === 'object') {
        const gid = guildOrLang.guild?.id || guildOrLang.guildId || (guildOrLang.isCommandContext ? guildOrLang.guild?.id : null);
        if (gid) {
            lang = getGuildLanguageSync(gid);
        }
    }

    const dict = TRANSLATIONS[lang] || TRANSLATIONS['en'];
    let str = dict[key] || TRANSLATIONS['en'][key] || key;

    for (const [k, v] of Object.entries(params)) {
        str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }

    return str;
}

// 6. UI Builder Helpers
function createLanguageSelectRow(currentLang = 'en', customId = 'starry_lang_select') {
    const options = Object.values(SUPPORTED_LANGUAGES).map(lang => ({
        label: `${lang.native} (${lang.name})`,
        value: lang.code,
        description: lang.description.length > 50 ? lang.description.substring(0, 47) + '...' : lang.description,
        emoji: lang.flag,
        default: lang.code === currentLang
    }));

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(customId)
        .setPlaceholder(t(currentLang, 'setup.select_lang_placeholder'))
        .addOptions(options);

    return new ActionRowBuilder().addComponents(selectMenu);
}

function createWelcomeSetupCard(guild, currentLang = 'en', botUser = null) {
    const langInfo = SUPPORTED_LANGUAGES[currentLang] || SUPPORTED_LANGUAGES['en'];
    const avatarUrl = botUser?.displayAvatarURL ? botUser.displayAvatarURL() : 'https://cdn.discordapp.com/embed/avatars/0.png';

    const embed = new EmbedBuilder()
        .setColor('#9B59B6')
        .setTitle(t(currentLang, 'setup.welcome_title'))
        .setDescription(t(currentLang, 'setup.welcome_desc', { guild: guild.name, lang: langInfo.native, flag: langInfo.flag }))
        .addFields(
            { 
                name: '🌐 ' + t(currentLang, 'setup.select_lang_title'), 
                value: `${langInfo.flag} **${langInfo.native}** (${langInfo.name})\n*Supported: 14 Languages (English, Español, Português, 日本語, हिन्दी, Français, Deutsch, etc.)*`,
                inline: false 
            },
            {
                name: '⚡ Quick Setup Commands',
                value: '• `,setup-starry` or `/setup-starry` — Auto-scan & link server layout\n• `,setup` or `/setup` — Deploy dedicated Music Controller channel\n• `,setlanguage` or `/setlanguage` — Change server language anytime',
                inline: false
            }
        )
        .setFooter({ text: 'Starry Multi-Language Engine • 14 Global Languages', iconURL: avatarUrl })
        .setTimestamp();

    const langRow = createLanguageSelectRow(currentLang, 'starry_lang_welcome_select');
    
    const btnRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('starry_welcome_start_setup')
            .setLabel(t(currentLang, 'setup.btn_setup'))
            .setStyle(ButtonStyle.Success)
            .setEmoji('🚀'),
        new ButtonBuilder()
            .setCustomId('starry_welcome_sync')
            .setLabel(t(currentLang, 'setup.btn_sync'))
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🧠')
    );

    return { embeds: [embed], components: [langRow, btnRow] };
}

function createSetupPromptCard(guild, currentLang = 'en', botUser = null) {
    const langInfo = SUPPORTED_LANGUAGES[currentLang] || SUPPORTED_LANGUAGES['en'];
    const avatarUrl = botUser?.displayAvatarURL ? botUser.displayAvatarURL() : 'https://cdn.discordapp.com/embed/avatars/0.png';

    const embed = new EmbedBuilder()
        .setColor('#9B59B6')
        .setTitle(t(currentLang, 'setup.sync_title'))
        .setDescription(
            t(currentLang, 'setup.sync_desc') + '\n\n' +
            `🌐 **${t(currentLang, 'setup.select_lang_title')}:** ${langInfo.flag} **${langInfo.native}** (${langInfo.name})`
        )
        .setFooter({ text: 'Starry Master Brain • Language: ' + langInfo.name, iconURL: avatarUrl })
        .setTimestamp();

    const langRow = createLanguageSelectRow(currentLang, 'starry_setup_lang_select');
    const btnRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('master_txt_confirm')
            .setLabel(t(currentLang, 'setup.btn_sync'))
            .setStyle(ButtonStyle.Success)
            .setEmoji('🧠'),
        new ButtonBuilder()
            .setCustomId('master_txt_cancel')
            .setLabel(t(currentLang, 'setup.btn_cancel'))
            .setStyle(ButtonStyle.Secondary)
    );

    return { embeds: [embed], components: [langRow, btnRow] };
}

module.exports = {
    SUPPORTED_LANGUAGES,
    LANGUAGE_ALIASES,
    resolveLanguageCode,
    guildLanguageCache,
    getGuildLanguage,
    getGuildLanguageSync,
    setGuildLanguage,
    t,
    createLanguageSelectRow,
    createWelcomeSetupCard,
    createSetupPromptCard
};
