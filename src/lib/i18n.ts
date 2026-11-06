export const locales = ['lv', 'en', 'ru'] as const;
export type Locale = (typeof locales)[number];
export function isLocale(s: string): s is Locale {
  return locales.includes(s as Locale);
}
export const copy = {
  lv: {
    nav: [
      'Par mums',
      'Pakalpojumi',
      'Cenas',
      'Pieraksts',
      'Jautājumi',
      'Kontakti',
    ],
    eyebrow: 'SKAIDRĪBA JŪSU FINANSĒS',
    title: 'Mazāk rūpju.\nVairāk iespēju.',
    intro:
      'Grāmatvedība un nodokļu konsultācijas uzņēmumiem un privātpersonām. Saprotami, pārskatāmi un jūsu valodā.',
    book: 'Pieteikt konsultāciju',
    explore: 'Apskatīt pakalpojumus',
    tag: 'Jūsu nākamais solis — ar pārliecību.',
    panelTitle: 'Finanses skaidrā perspektīvā',
    panelText: 'No ikdienas uzskaites līdz nākamajam biznesa lēmumam.',
    panelTags: ['Grāmatvedība', 'Nodokļi', 'Konsultācijas'],
    aboutTitle: 'Jūs veidojat biznesu. Mēs palīdzam ar skaitļiem.',
    about:
      'TaxSolutions piedāvā grāmatvedības un nodokļu atbalstu, pielāgojot pakalpojumu apjomu jūsu vajadzībām. Sadarbības noteikumus un cenu vienojamies pirms darba sākšanas.',
    benefits: [
      'Skaidrs darba apjoms',
      'Saziņa LV / EN / RU',
      'Attālināti vai klātienē',
    ],
    servicesTitle: 'Atbalsts katrā uzņēmējdarbības posmā',
    servicesIntro:
      'Izvēlieties nepieciešamo atbalstu. Pārējo izrunāsim konsultācijā.',
    pricesTitle: 'Skaidras cenas. Pārskatāma sadarbība.',
    demo: 'Demonstrācijas cenas — nav saistošs piedāvājums. Gala cenu saskaņosim individuāli.',
    from: 'no',
    hour: '/ stundā',
    month: '/ mēnesī',
    fixed: 'fiksēti',
    bookingTitle: 'Atvēlēsim laiku jūsu jautājumiem.',
    bookingIntro:
      'Izvēlieties pakalpojumu, datumu un brīvu laiku. Visas tikšanās norādītas Rīgas laikā.',
    service: 'Pakalpojums',
    date: 'Datums',
    time: 'Brīvais laiks',
    name: 'Vārds, uzvārds',
    email: 'E-pasts',
    phone: 'Tālrunis',
    comment: 'Komentārs (nav obligāts)',
    message: 'Ziņa',
    consent:
      'Esmu iepazinies ar privātuma politiku un piekrītu datu apstrādei pieraksta nodrošināšanai.',
    submit: 'Apstiprināt pierakstu',
    loading: 'Ielādē…',
    noSlots: 'Šajā datumā nav brīvu laiku.',
    success:
      'Pieraksts saglabāts. Saglabājiet atcelšanas saiti. Apstiprinājums tiks nosūtīts e-pastā.',
    cancel: 'Atcelt pierakstu',
    cancelled: 'Pieraksts atcelts.',
    error: 'Darbību neizdevās pabeigt. Pārbaudiet ievadi un mēģiniet vēlreiz.',
    conflict: 'Šis laiks vairs nav pieejams. Izvēlieties citu laiku.',
    invalid: 'Pārbaudiet ievadītos datus un piekrišanu.',
    rate: 'Pārāk daudz pieprasījumu. Mēģiniet vēlāk.',
    faqTitle: 'Atbildes pirms pirmās sarunas',
    faq: [
      [
        'Vai varam sadarboties attālināti?',
        'Jā, konsultācijas un dokumentu apmaiņu var organizēt attālināti. Formātu saskaņosim pirms tikšanās.',
      ],
      [
        'Kā tiek noteikta gala cena?',
        'Cena ir atkarīga no dokumentu apjoma, darbinieku skaita un nepieciešamajiem pakalpojumiem. Pirms darba vienojamies par piedāvājumu.',
      ],
      [
        'Ko sagatavot konsultācijai?',
        'Īsu jautājuma aprakstu un attiecīgos dokumentus. Sensitīvus dokumentus publiskajā formā nepievienojiet.',
      ],
      [
        'Vai pierakstu var atcelt?',
        'Jā. Izmantojiet saiti, kas parādīta pēc pieraksta un nosūtīta e-pastā. Lai mainītu laiku, atceliet un izveidojiet jaunu pierakstu.',
      ],
    ],
    contactsTitle: 'Sāksim ar sarunu.',
    contactIntro:
      'Kontaktinformācija tiks publicēta pirms pakalpojuma uzsākšanas.',
    placeholder: 'Vēl nav norādīts',
    contactSend: 'Nosūtīt ziņu',
    contactSuccess: 'Ziņa saņemta. Atbildēsim uz norādīto e-pastu.',
    privacy: 'Privātuma politika',
    terms: 'Pakalpojumu noteikumi',
    legal: 'Juridiskā informācija',
    footer: 'Skaidrība skaitļos. Pārliecība lēmumos.',
    back: 'Atgriezties',
    closed: 'Slēgts',
    demoNotice: 'Vietne sagatavošanā · cenas demonstrācijai',
    privacyText:
      'Datu pārzinis: [uzņēmuma nosaukums, reģistrācijas numurs, adrese un kontaktinformācija — jāaizpilda pirms darbības sākšanas]. Pieraksta nodrošināšanai apstrādājam vārdu, e-pastu, tālruni, pakalpojumu un tikšanās laiku. Pamats: darbības pirms līguma noslēgšanas pēc jūsu pieprasījuma (VDAR 6. panta 1. punkta b) apakšpunkts). Drošības nodrošināšanai izmantojam īslaicīgu pieprasījumu uzskaiti (leģitīmās intereses). Hostinga un e-pasta pakalpojumu sniedzēji un to apstrādes noteikumi jāapstiprina. Pierakstu, pieprasījumu un e-pastu glabāšanas termiņi vēl nav apstiprināti un jānosaka pirms darbības sākšanas. Jūs varat pieprasīt piekļuvi, labošanu, dzēšanu vai apstrādes ierobežošanu, kā arī vērsties Datu valsts inspekcijā. Analītikas un reklāmas sīkdatnes neizmantojam. Administratora sesijai izmantojam nepieciešamu drošu sīkdatni. Šī politika jāpārskata un jāpapildina ar pārziņa un apstrādātāju datiem pirms publiskas darbības.',
    termsText:
      'Cenas ir demonstrācijas vērtības EUR. Pakalpojumu apjomu, nodokļu piemērošanu, apmaksu un atbildību nosaka individuāli noslēgtais līgums. Pieraksts ir konsultācijas pieprasījums un negarantē juridisku vai nodokļu rezultātu. Pierakstu iespējams atcelt, izmantojot personīgo saiti. Lai mainītu laiku, izveidojiet jaunu pierakstu. Operatora rekvizīti un gala noteikumi jāaizpilda pirms darbības sākšanas.',
    legalText:
      'Uzņēmums: [jāaizpilda]. Reģistrācijas numurs: [jāaizpilda]. PVN numurs un statuss: [jāaizpilda]. Juridiskā adrese: [jāaizpilda]. Atbildīgā persona un kontaktinformācija: [jāaizpilda]. Vietnes saturs ir informatīvs un neaizstāj individuālu konsultāciju.',
  },
  en: {
    nav: ['About', 'Services', 'Pricing', 'Book a meeting', 'FAQ', 'Contact'],
    eyebrow: 'CLARITY FOR YOUR FINANCES',
    title: 'Less complexity.\nMore possibility.',
    intro:
      'Accounting and tax support for businesses and individuals. Clear, transparent and in your language.',
    book: 'Book a consultation',
    explore: 'Explore our services',
    tag: 'Your next step. With confidence.',
    panelTitle: 'A clearer financial perspective',
    panelText: 'From everyday bookkeeping to your next business decision.',
    panelTags: ['Accounting', 'Tax', 'Advisory'],
    aboutTitle: 'You build your business. We help with the numbers.',
    about:
      'TaxSolutions offers accounting and tax support tailored to your needs. We agree on the scope, terms and price before work begins.',
    benefits: [
      'A clear scope of work',
      'Support in LV / EN / RU',
      'Online or in person',
    ],
    servicesTitle: 'Support at every stage of business',
    servicesIntro:
      'Choose the support you need. We will discuss the details together.',
    pricesTitle: 'Clear pricing. Transparent collaboration.',
    demo: 'Illustrative prices — not a binding offer. Final fees are agreed individually.',
    from: 'from',
    hour: '/ hour',
    month: '/ month',
    fixed: 'fixed',
    bookingTitle: 'Make room for your questions.',
    bookingIntro:
      'Choose a service, date and available time. All appointments use Europe/Riga time.',
    service: 'Service',
    date: 'Date',
    time: 'Available time',
    name: 'Full name',
    email: 'Email',
    phone: 'Phone',
    comment: 'Comment (optional)',
    message: 'Message',
    consent:
      'I have read the privacy policy and agree to the processing of my information to arrange this appointment.',
    submit: 'Confirm appointment',
    loading: 'Loading…',
    noSlots: 'No available times on this date.',
    success:
      'Appointment saved. Keep your cancellation link. A confirmation will be sent by email.',
    cancel: 'Cancel appointment',
    cancelled: 'Appointment cancelled.',
    error: 'Unable to complete the request. Check your details and try again.',
    conflict: 'This time is no longer available. Please select another.',
    invalid: 'Check your details and consent.',
    rate: 'Too many requests. Please try again later.',
    faqTitle: 'A few answers before we meet',
    faq: [
      [
        'Can we work remotely?',
        'Yes. Consultations and document exchange can be arranged remotely. We will agree on the format before meeting.',
      ],
      [
        'How is the final fee calculated?',
        'Fees depend on document volume, employee numbers and the services required. We agree on a proposal before work begins.',
      ],
      [
        'What should I prepare?',
        'A short description of your question and relevant documents. Do not include sensitive documents in the public form.',
      ],
      [
        'Can I cancel an appointment?',
        'Yes. Use the link shown after booking and sent by email. To reschedule, cancel and make a new booking.',
      ],
    ],
    contactsTitle: 'Let’s start a conversation.',
    contactIntro:
      'Contact information will be published before services launch.',
    placeholder: 'Not provided yet',
    contactSend: 'Send message',
    contactSuccess: 'Message received. We will reply to your email.',
    privacy: 'Privacy policy',
    terms: 'Terms of service',
    legal: 'Legal information',
    footer: 'Clarity in numbers. Confidence in decisions.',
    back: 'Go back',
    closed: 'Closed',
    demoNotice: 'Website in preparation · illustrative pricing',
    privacyText:
      'Data controller: [company name, registration number, address and contact details — complete before launch]. We process your name, email, phone, service and appointment time to arrange your consultation. Legal basis: steps at your request before entering a contract (GDPR Article 6(1)(b)). Short-lived request counters protect the service under legitimate interests. Hosting and email providers and their processing terms must be confirmed. Retention periods for appointments, inquiries and emails are not yet confirmed and must be set before launch. You may request access, rectification, erasure or restriction and complain to the Latvian Data State Inspectorate. We use no analytics or advertising cookies. Administrators use an essential secure session cookie. Review and complete this policy with controller and processor details before public operation.',
    termsText:
      'Prices are illustrative EUR values. Scope, applicable taxes, payment and liability are set in an individual agreement. Booking requests a consultation and does not guarantee any legal or tax outcome. Cancel using your personal link. To reschedule, make a new booking. Operator details and final terms must be completed before launch.',
    legalText:
      'Company: [to be completed]. Registration number: [to be completed]. VAT number and status: [to be completed]. Registered address: [to be completed]. Responsible person and contact: [to be completed]. Website information does not replace individual advice.',
  },
  ru: {
    nav: ['О нас', 'Услуги', 'Цены', 'Онлайн-запись', 'Вопросы', 'Контакты'],
    eyebrow: 'ЯСНОСТЬ В ВАШИХ ФИНАНСАХ',
    title: 'Меньше сложностей.\nБольше возможностей.',
    intro:
      'Бухгалтерия и налоговые консультации для бизнеса и частных лиц. Понятно, прозрачно и на вашем языке.',
    book: 'Записаться на консультацию',
    explore: 'Посмотреть услуги',
    tag: 'Ваш следующий шаг — с уверенностью.',
    panelTitle: 'Финансы в ясной перспективе',
    panelText: 'От ежедневного учёта до следующего решения для бизнеса.',
    panelTags: ['Бухгалтерия', 'Налоги', 'Консультации'],
    aboutTitle: 'Вы развиваете бизнес. Мы помогаем с цифрами.',
    about:
      'TaxSolutions предлагает бухгалтерскую и налоговую поддержку с учётом ваших задач. Объём работы, условия и стоимость согласовываются до начала сотрудничества.',
    benefits: [
      'Понятный объём работы',
      'Общение на LV / EN / RU',
      'Онлайн или лично',
    ],
    servicesTitle: 'Поддержка на каждом этапе бизнеса',
    servicesIntro:
      'Выберите необходимую помощь. Детали обсудим на консультации.',
    pricesTitle: 'Понятные цены. Прозрачное сотрудничество.',
    demo: 'Демонстрационные цены — не оферта. Итоговая стоимость согласовывается индивидуально.',
    from: 'от',
    hour: '/ час',
    month: '/ месяц',
    fixed: 'фиксированно',
    bookingTitle: 'Найдём время для ваших вопросов.',
    bookingIntro:
      'Выберите услугу, дату и свободное время. Все встречи указаны по времени Риги.',
    service: 'Услуга',
    date: 'Дата',
    time: 'Свободное время',
    name: 'Имя и фамилия',
    email: 'Email',
    phone: 'Телефон',
    comment: 'Комментарий (необязательно)',
    message: 'Сообщение',
    consent:
      'Я ознакомился с политикой конфиденциальности и согласен на обработку данных для организации записи.',
    submit: 'Подтвердить запись',
    loading: 'Загрузка…',
    noSlots: 'На эту дату свободного времени нет.',
    success:
      'Запись сохранена. Сохраните ссылку отмены. Подтверждение будет отправлено на email.',
    cancel: 'Отменить запись',
    cancelled: 'Запись отменена.',
    error:
      'Не удалось выполнить запрос. Проверьте данные и попробуйте ещё раз.',
    conflict: 'Это время уже недоступно. Выберите другое.',
    invalid: 'Проверьте введённые данные и согласие.',
    rate: 'Слишком много запросов. Попробуйте позже.',
    faqTitle: 'Ответы перед первой встречей',
    faq: [
      [
        'Можно ли работать удалённо?',
        'Да, консультации и обмен документами можно организовать удалённо. Формат согласуем перед встречей.',
      ],
      [
        'Как определяется итоговая цена?',
        'Стоимость зависит от объёма документов, количества сотрудников и необходимых услуг. Предложение согласовывается до начала работы.',
      ],
      [
        'Что подготовить к консультации?',
        'Краткое описание вопроса и относящиеся к нему документы. Не отправляйте конфиденциальные документы через публичную форму.',
      ],
      [
        'Можно ли отменить запись?',
        'Да. Используйте ссылку, которая появляется после записи и приходит на email. Для переноса отмените запись и создайте новую.',
      ],
    ],
    contactsTitle: 'Начнём с разговора.',
    contactIntro:
      'Контактная информация будет опубликована до начала оказания услуг.',
    placeholder: 'Пока не указано',
    contactSend: 'Отправить сообщение',
    contactSuccess: 'Сообщение получено. Ответим на указанный email.',
    privacy: 'Политика конфиденциальности',
    terms: 'Условия оказания услуг',
    legal: 'Юридическая информация',
    footer: 'Ясность в цифрах. Уверенность в решениях.',
    back: 'Вернуться',
    closed: 'Закрыто',
    demoNotice: 'Сайт готовится к запуску · демонстрационные цены',
    privacyText:
      'Оператор данных: [название компании, регистрационный номер, адрес и контакты — заполнить до запуска]. Для организации консультации обрабатываются имя, email, телефон, услуга и время встречи. Основание: действия по вашему запросу до заключения договора (статья 6(1)(b) GDPR). Краткосрочные счётчики запросов используются для защиты сервиса на основании законного интереса. Провайдеров хостинга и почты и условия их обработки необходимо подтвердить. Сроки хранения записей, обращений и писем ещё не подтверждены и должны быть установлены до запуска. Вы можете запросить доступ, исправление, удаление или ограничение обработки и обратиться в Государственную инспекцию данных Латвии. Аналитические и рекламные cookies не используются. Для администратора используется необходимая защищённая cookie сессии. До запуска политику необходимо проверить и дополнить данными оператора и обработчиков.',
    termsText:
      'Цены — демонстрационные значения в EUR. Объём услуг, налоги, оплата и ответственность определяются индивидуальным договором. Запись является запросом консультации и не гарантирует юридического или налогового результата. Отмена доступна по персональной ссылке. Для переноса создайте новую запись. Реквизиты оператора и окончательные условия необходимо заполнить до запуска.',
    legalText:
      'Компания: [заполнить]. Регистрационный номер: [заполнить]. Номер и статус НДС: [заполнить]. Юридический адрес: [заполнить]. Ответственное лицо и контакты: [заполнить]. Информация на сайте не заменяет индивидуальную консультацию.',
  },
};
export type Copy = typeof copy.en;
