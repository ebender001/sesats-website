(function () {
  const QUESTION_BANK_TABS = ["questions", "media", "references", "ai-assets", "templates"];
  const QUESTION_BANK_DIFFICULTIES = ["Easy", "Moderate", "Hard", "Expert"];
  const QUESTION_BANK_STATUS_ORDER = [
    "Draft",
    "Needs Review",
    "Revision Requested",
    "Approved / Ready",
    "Published",
    "Archived",
  ];
  const CURRENT_YEAR = new Date().getFullYear();

  function createDefaultState() {
    return {
      activeTab: "questions",
      filtersExpanded: typeof window === "undefined" ? true : window.innerWidth > 680,
      loading: true,
      selectedQuestionIds: new Set(),
      previewQuestionId: "",
      feedback: {
        message: "",
        type: "success",
      },
      datasets: {
        questions: [],
        media: [],
        references: [],
        aiAssets: [],
        templates: [],
      },
      filterValues: {
        search: "",
        status: "",
        specialty: "",
        difficulty: "",
      },
      filterOptions: {
        statuses: [],
        specialties: [],
        difficulties: [...QUESTION_BANK_DIFFICULTIES],
      },
      meta: {
        dataSources: {
          questions: "live",
          media: "live",
          references: "live",
          aiAssets: "live",
          templates: "mock",
        },
      },
      listenersBound: false,
    };
  }

  let questionBankState = createDefaultState();

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => {
      const entities = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      };

      return entities[character] || character;
    });
  }

  function slugify(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function truncateText(value, maxLength) {
    const normalized = String(value || "").replace(/\s+/g, " ").trim();
    if (!normalized) {
      return "Untitled question";
    }

    if (normalized.length <= maxLength) {
      return normalized;
    }

    return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
  }

  function formatShortDate(value) {
    if (!value) {
      return "Not set";
    }

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "Not set";
    }

    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
  }

  function formatDateTime(value) {
    if (!value) {
      return "Not set";
    }

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "Not set";
    }

    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  }

  function downloadTextFile(filename, contents) {
    const blob = new Blob([contents], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function csvEscape(value) {
    const normalized = String(value ?? "");
    if (/[",\n]/.test(normalized)) {
      return `"${normalized.replace(/"/g, '""')}"`;
    }

    return normalized;
  }

  function getQuestionEditUrl(questionId) {
    return `edit.html?id=${encodeURIComponent(questionId)}`;
  }

  function getSelectedQuestionRecords() {
    return questionBankState.datasets.questions.filter((question) =>
      questionBankState.selectedQuestionIds.has(question.objectId)
    );
  }

  function setFeedback(message, type) {
    questionBankState.feedback.message = message || "";
    questionBankState.feedback.type = type === "error" ? "error" : "success";
    renderFeedback();
  }

  function getPreviewQuestion() {
    return questionBankState.datasets.questions.find(
      (question) => question.objectId === questionBankState.previewQuestionId
    );
  }

  function normalizeQuestionOption(option) {
    const safeOption = option && typeof option === "object" ? option : {};
    return {
      label: String(safeOption.label || "").trim(),
      text: String(safeOption.text || "").trim(),
      isCorrect: safeOption.isCorrect === true,
    };
  }

  function deriveQuestionTitle(stem, topic, specialty) {
    const compactStem = truncateText(stem, 78);

    if (compactStem && compactStem !== "Untitled question") {
      return compactStem;
    }

    return [topic, specialty].filter(Boolean).join(" - ") || "Untitled question";
  }

  function normalizeQuestionRecord(question, { referencesByQuestionId, mediaByQuestionId, usersById }) {
    const safeQuestion = question && typeof question === "object" ? question : {};
    const questionOptions = Array.isArray(safeQuestion.questionOptions)
      ? safeQuestion.questionOptions.map(normalizeQuestionOption)
      : [];
    const correctOption = questionOptions.find((option) => option.isCorrect);
    const referenceRecords = referencesByQuestionId.get(String(safeQuestion.objectId || "")) || [];
    const mediaRecords = mediaByQuestionId.get(String(safeQuestion.objectId || "")) || [];
    const stem = String(safeQuestion.stem || "").trim();
    const critique = String(safeQuestion.critique || safeQuestion.explanation || "").trim();
    const authorName =
      usersById.get(String(safeQuestion.lastEditedByObjectId || safeQuestion.createdByObjectId || "")) ||
      usersById.get(String(safeQuestion.createdByObjectId || "")) ||
      "Editorial Team";

    const searchableText = [
      stem,
      critique,
      safeQuestion.specialty,
      safeQuestion.topic,
      safeQuestion.status,
      safeQuestion.difficulty,
      authorName,
      referenceRecords.map((reference) => reference.searchableText).join(" "),
    ]
      .join(" ")
      .toLowerCase();

    return {
      objectId: String(safeQuestion.objectId || ""),
      idLabel: String(safeQuestion.objectId || "").slice(-8).toUpperCase() || "UNKNOWN",
      title: deriveQuestionTitle(stem, safeQuestion.topic, safeQuestion.specialty),
      specialty: String(safeQuestion.specialty || "Unassigned"),
      topic: String(safeQuestion.topic || "General"),
      status: String(safeQuestion.status || "Draft"),
      difficulty: String(safeQuestion.difficulty || "Moderate"),
      referencesCount: referenceRecords.length,
      mediaCount: mediaRecords.length,
      lastEditedAt: safeQuestion.lastEditedAt || safeQuestion.updatedAt || safeQuestion.createdAt || "",
      lastEditedLabel: formatDateTime(
        safeQuestion.lastEditedAt || safeQuestion.updatedAt || safeQuestion.createdAt || ""
      ),
      author: authorName,
      stem,
      critique,
      correctAnswer: correctOption
        ? `${correctOption.label ? `${correctOption.label}. ` : ""}${correctOption.text}`
        : "Correct answer not set",
      questionOptions,
      referenceRecords,
      mediaRecords,
      aiModel: String(safeQuestion.aiModel || ""),
      aiPromptVersion: String(safeQuestion.aiPromptVersion || ""),
      generatedByAI: safeQuestion.generatedByAI === true,
      searchableText,
    };
  }

  function normalizeMediaRecord(record, questionsById, usersById) {
    const safeRecord = record && typeof record === "object" ? record : {};
    const linkedQuestionId = String(safeRecord.questionObjectId || "");
    const linkedQuestion = questionsById.get(linkedQuestionId) || null;
    const fileName = String(safeRecord.fileName || safeRecord.fileKey || "")
      .split("/")
      .pop();
    const usageStatus = linkedQuestionId ? "Used" : "Unused / orphaned";

    return {
      objectId: String(safeRecord.objectId || `${linkedQuestionId}-${fileName}`),
      thumbnail: String(safeRecord.thumbnail || safeRecord.publicUrl || ""),
      type: String(safeRecord.mediaType || "IMAGE"),
      filename: fileName || "Unnamed asset",
      linkedQuestion: linkedQuestion ? linkedQuestion.title : "Not linked",
      linkedQuestionId,
      uploadedBy:
        usersById.get(String(safeRecord.uploadedByObjectId || "")) || safeRecord.uploadedBy || "Editorial Team",
      uploadDate: formatShortDate(safeRecord.uploadedAt || safeRecord.createdAt || ""),
      size: String(safeRecord.sizeLabel || safeRecord.size || "Unknown"),
      status: usageStatus,
      searchableText: [
        fileName,
        safeRecord.mediaType,
        linkedQuestion?.title,
        safeRecord.uploadedBy,
        usageStatus,
      ]
        .join(" ")
        .toLowerCase(),
    };
  }

  function deriveReferenceStatus(record) {
    if (String(record.status || "").trim()) {
      return record.status;
    }

    const year = Number(record.year);
    if (Number.isFinite(year) && year > 0 && year <= CURRENT_YEAR - 8) {
      return "Review";
    }

    return "Current";
  }

  function normalizeReferenceRecord(record, questionCountByReferenceId) {
    const safeRecord = record && typeof record === "object" ? record : {};
    const authors = String(safeRecord.authors || "").trim();
    const firstAuthor = authors ? authors.split(/,|;/)[0].trim() : "Unknown";
    const referenceStatus = deriveReferenceStatus(safeRecord);
    const citation =
      String(safeRecord.citationText || "").trim() ||
      String(safeRecord.title || "").trim() ||
      "Untitled reference";

    return {
      objectId: String(safeRecord.objectId || citation),
      citation,
      firstAuthor,
      journal: String(safeRecord.journal || "Unknown"),
      year: safeRecord.year || "—",
      pmid: String(safeRecord.pmid || "—"),
      doi: String(safeRecord.doi || "—"),
      questionsUsing: questionCountByReferenceId.get(String(safeRecord.objectId || "")) || 0,
      lastVerified: formatShortDate(safeRecord.updatedAt || safeRecord.createdAt || ""),
      status: referenceStatus,
      searchableText: [citation, firstAuthor, safeRecord.journal, safeRecord.pmid, safeRecord.doi]
        .join(" ")
        .toLowerCase(),
    };
  }

  function normalizeAiAssetRecord(record) {
    const safeRecord = record && typeof record === "object" ? record : {};
    return {
      objectId: String(safeRecord.objectId || `${safeRecord.questionId}-${safeRecord.assetType}`),
      questionId: String(safeRecord.questionId || "Unknown"),
      assetType: String(safeRecord.assetType || "Question Draft"),
      model: String(safeRecord.model || "Unknown"),
      promptVersion: String(safeRecord.promptVersion || "—"),
      generatedAt: formatDateTime(safeRecord.generatedAt || safeRecord.updatedAt || ""),
      cached: safeRecord.cached === false ? "No" : "Yes",
      needsRegeneration: safeRecord.needsRegeneration === true ? "Yes" : "No",
      searchableText: [
        safeRecord.questionId,
        safeRecord.assetType,
        safeRecord.model,
        safeRecord.promptVersion,
      ]
        .join(" ")
        .toLowerCase(),
    };
  }

  function normalizeTemplateRecord(record) {
    const safeRecord = record && typeof record === "object" ? record : {};
    return {
      objectId: String(safeRecord.objectId || safeRecord.name || Math.random()),
      templateName: String(safeRecord.templateName || safeRecord.name || "Untitled template"),
      type: String(safeRecord.type || "Prompt"),
      version: String(safeRecord.version || "v1"),
      lastModified: formatDateTime(safeRecord.lastModified || safeRecord.updatedAt || ""),
      active: safeRecord.active === false ? "No" : "Yes",
      searchableText: [safeRecord.templateName, safeRecord.type, safeRecord.version]
        .join(" ")
        .toLowerCase(),
    };
  }

  function buildMockQuestionBankData() {
    const mockReferences = [
      {
        objectId: "ref-guideline-2024",
        citationText:
          "STS Adult Cardiac Surgery Database Task Force. Contemporary valve guideline update. J Thorac Cardiovasc Surg. 2024.",
        title: "Contemporary valve guideline update",
        authors: "STS Adult Cardiac Surgery Database Task Force",
        journal: "J Thorac Cardiovasc Surg",
        year: 2024,
        pmid: "40112233",
        doi: "10.1016/mock.2024.001",
        updatedAt: "2026-05-12T14:12:00Z",
      },
      {
        objectId: "ref-aorta-2015",
        citationText:
          "Patel R, Singh A. Aortic catastrophe review for thoracic trainees. Ann Thorac Surg. 2015.",
        title: "Aortic catastrophe review for thoracic trainees",
        authors: "Patel R, Singh A",
        journal: "Ann Thorac Surg",
        year: 2015,
        pmid: "26555192",
        doi: "10.1016/mock.2015.002",
        updatedAt: "2026-04-09T09:45:00Z",
      },
      {
        objectId: "ref-transplant-2022",
        citationText:
          "Morgan E, Liu S. Perioperative transplant immunology pearls. Semin Thorac Cardiovasc Surg. 2022.",
        title: "Perioperative transplant immunology pearls",
        authors: "Morgan E, Liu S",
        journal: "Semin Thorac Cardiovasc Surg",
        year: 2022,
        pmid: "37710021",
        doi: "10.1016/mock.2022.010",
        updatedAt: "2026-06-03T10:10:00Z",
      },
    ];

    const mockQuestions = [
      {
        objectId: "qbmock001",
        stem:
          "A 67-year-old man presents with acute type A aortic dissection and malperfusion. Which operative priority best addresses immediate mortality risk while preserving neurologic protection?",
        critique:
          "The critique emphasizes rapid central repair, cerebral protection strategy, and avoiding delay for distal interventions before proximal control is achieved.",
        specialty: "Adult Cardiac",
        topic: "Aortic Surgery",
        status: "Needs Review",
        difficulty: "Hard",
        lastEditedAt: "2026-06-24T13:05:00Z",
        updatedAt: "2026-06-24T13:05:00Z",
        createdAt: "2026-06-01T08:30:00Z",
        createdByObjectId: "user-mock-1",
        lastEditedByObjectId: "user-mock-2",
        questionOptions: [
          { label: "A", text: "Proceed with endovascular fenestration before sternotomy", isCorrect: false },
          { label: "B", text: "Repair the proximal tear with cerebral protection and restore true lumen flow", isCorrect: true },
          { label: "C", text: "Treat medically until lactate normalizes", isCorrect: false },
          { label: "D", text: "Defer surgery until CTA perfusion mapping is repeated", isCorrect: false },
        ],
      },
      {
        objectId: "qbmock002",
        stem:
          "During mitral valve repair planning for degenerative disease with posterior leaflet prolapse, which finding most strongly supports durable repair over replacement?",
        critique:
          "Durability improves when the pathology is focal, annular geometry is preserved, and the subvalvular apparatus can be maintained.",
        specialty: "Adult Cardiac",
        topic: "Valve",
        status: "Approved / Ready",
        difficulty: "Moderate",
        lastEditedAt: "2026-06-18T17:25:00Z",
        updatedAt: "2026-06-18T17:25:00Z",
        createdAt: "2026-05-20T11:00:00Z",
        createdByObjectId: "user-mock-2",
        lastEditedByObjectId: "user-mock-2",
        questionOptions: [
          { label: "A", text: "Diffuse rheumatic restriction", isCorrect: false },
          { label: "B", text: "Focal P2 prolapse with preserved leaflet tissue quality", isCorrect: true },
          { label: "C", text: "Extensive annular calcification invading the ventricle", isCorrect: false },
          { label: "D", text: "Papillary muscle rupture after infarction with necrosis", isCorrect: false },
        ],
        generatedByAI: true,
        aiModel: "gpt-4.1-mini",
        aiPromptVersion: "qb-v3.2",
      },
      {
        objectId: "qbmock003",
        stem:
          "A donor lung offer becomes available for a sensitized recipient with worsening oxygen requirements. What is the most important preoperative coordination step before proceeding to transplant?",
        critique:
          "The key is coordination across immunology, perfusion, and procurement logistics to avoid preventable incompatibility or ischemic delay.",
        specialty: "Thoracic",
        topic: "Transplant",
        status: "Draft",
        difficulty: "Expert",
        lastEditedAt: "2026-06-27T09:10:00Z",
        updatedAt: "2026-06-27T09:10:00Z",
        createdAt: "2026-06-21T07:15:00Z",
        createdByObjectId: "user-mock-3",
        lastEditedByObjectId: "user-mock-3",
        questionOptions: [
          { label: "A", text: "Wait for ward bed assignment first", isCorrect: false },
          { label: "B", text: "Confirm virtual crossmatch and antibody strategy before accepting transport timing", isCorrect: true },
          { label: "C", text: "Delay immunology review until the donor arrives", isCorrect: false },
          { label: "D", text: "Prioritize bronchoscopy scheduling over procurement details", isCorrect: false },
        ],
      },
    ];

    const mockQuestionReferenceLinks = [
      { questionObjectId: "qbmock001", referenceObjectId: "ref-guideline-2024" },
      { questionObjectId: "qbmock001", referenceObjectId: "ref-aorta-2015" },
      { questionObjectId: "qbmock002", referenceObjectId: "ref-guideline-2024" },
      { questionObjectId: "qbmock003", referenceObjectId: "ref-transplant-2022" },
    ];

    const mockMedia = [
      {
        objectId: "media-mock-1",
        questionObjectId: "qbmock001",
        mediaType: "IMAGE",
        fileKey: "questions/qbmock001/question/image/cta-dissection.png",
        publicUrl: "",
        uploadedBy: "Avery Chen",
        uploadedAt: "2026-06-22T12:00:00Z",
      },
      {
        objectId: "media-mock-2",
        questionObjectId: "qbmock003",
        mediaType: "VIDEO",
        fileKey: "questions/qbmock003/critique/video/transplant-anastomosis.mp4",
        publicUrl: "",
        uploadedBy: "Jordan Patel",
        uploadedAt: "2026-06-26T16:40:00Z",
      },
      {
        objectId: "media-mock-3",
        questionObjectId: "",
        mediaType: "IMAGE",
        fileKey: "uploads/orphaned/coronary-graft-template.png",
        publicUrl: "",
        uploadedBy: "Editorial Team",
        uploadedAt: "2026-05-28T14:10:00Z",
      },
    ];

    const mockUsers = new Map([
      ["user-mock-1", "Avery Chen"],
      ["user-mock-2", "Jordan Patel"],
      ["user-mock-3", "Morgan Diaz"],
    ]);

    const mockAiAssets = [
      {
        objectId: "ai-mock-1",
        questionId: "Q-BMOCK002",
        assetType: "Question Draft",
        model: "gpt-4.1-mini",
        promptVersion: "qb-v3.2",
        generatedAt: "2026-06-18T17:25:00Z",
        cached: true,
        needsRegeneration: false,
      },
      {
        objectId: "ai-mock-2",
        questionId: "Q-BMOCK003",
        assetType: "Critique Summary",
        model: "gpt-4.1-mini",
        promptVersion: "critique-v2.1",
        generatedAt: "2026-06-27T09:10:00Z",
        cached: false,
        needsRegeneration: true,
      },
    ];

    const mockTemplates = [
      {
        objectId: "template-mock-1",
        templateName: "Cardiac MCQ Generation",
        type: "Prompt",
        version: "v3.2",
        lastModified: "2026-06-15T09:00:00Z",
        active: true,
      },
      {
        objectId: "template-mock-2",
        templateName: "Reference Verification Checklist",
        type: "Workflow",
        version: "v1.7",
        lastModified: "2026-05-29T15:30:00Z",
        active: true,
      },
      {
        objectId: "template-mock-3",
        templateName: "Legacy AI Critique Prompt",
        type: "Prompt",
        version: "v0.9",
        lastModified: "2026-02-11T10:45:00Z",
        active: false,
      },
    ];

    return {
      questions: mockQuestions,
      references: mockReferences,
      questionReferenceLinks: mockQuestionReferenceLinks,
      media: mockMedia,
      usersById: mockUsers,
      aiAssets: mockAiAssets,
      templates: mockTemplates,
    };
  }

  async function fetchCloudList(functionName, fallbackValue) {
    if (!window.back4app || typeof window.back4app.runCloudFunction !== "function") {
      return fallbackValue;
    }

    try {
      const result = await window.back4app.runCloudFunction(functionName);
      return Array.isArray(result) ? result : fallbackValue;
    } catch (error) {
      console.error(`Unable to load ${functionName}.`, error);
      return fallbackValue;
    }
  }

  async function fetchUsersByIds(userIds, mockUsers) {
    const usersById = new Map(mockUsers || []);
    const uniqueIds = Array.from(new Set((userIds || []).filter(Boolean)));

    if (!uniqueIds.length || typeof Parse === "undefined") {
      return usersById;
    }

    try {
      const query = new Parse.Query(Parse.User);
      query.containedIn("objectId", uniqueIds);
      query.select("name", "firstName", "lastName", "username");
      query.limit(1000);

      const users = await query.find({ useMasterKey: true });
      users.forEach((user) => {
        const fullName = [user.get("firstName"), user.get("lastName")].filter(Boolean).join(" ").trim();
        usersById.set(user.id, fullName || user.get("name") || user.get("username") || "Editorial Team");
      });
    } catch (error) {
      console.error("Unable to load Parse users for the question bank.", error);
    }

    return usersById;
  }

  async function fetchQuestionMediaRecords(mockMedia) {
    if (typeof Parse === "undefined") {
      return {
        dataSource: "mock",
        records: mockMedia,
      };
    }

    try {
      const QuestionMedia = Parse.Object.extend("QuestionMedia");
      const query = new Parse.Query(QuestionMedia);
      query.include("question");
      query.include("uploadedBy");
      query.descending("uploadedAt");
      query.limit(1000);

      const records = await query.find({ useMasterKey: true });
      return {
        dataSource: "live",
        records: records.map((record) => ({
          objectId: record.id,
          questionObjectId: record.get("question")?.id || "",
          mediaType: record.get("mediaType") || "",
          fileKey: record.get("fileKey") || "",
          publicUrl: record.get("publicUrl") || "",
          uploadedAt: record.get("uploadedAt") || record.createdAt,
          uploadedByObjectId: record.get("uploadedBy")?.id || "",
          uploadedBy: record.get("uploadedBy")?.get("username") || "",
          status: record.get("status") || "",
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
        })),
      };
    } catch (error) {
      console.error("Unable to load question media.", error);
      return {
        dataSource: "mock",
        records: mockMedia,
      };
    }
  }

  async function fetchReferenceRecords(mockReferences, mockQuestionReferenceLinks) {
    if (typeof Parse === "undefined") {
      return {
        dataSource: "mock",
        references: mockReferences,
        questionReferenceLinks: mockQuestionReferenceLinks,
      };
    }

    try {
      const Reference = Parse.Object.extend("Reference");
      const QuestionReference = Parse.Object.extend("QuestionReference");
      const [referenceObjects, linkObjects] = await Promise.all([
        new Parse.Query(Reference)
          .descending("updatedAt")
          .limit(1000)
          .find({ useMasterKey: true }),
        new Parse.Query(QuestionReference)
          .include("question")
          .include("reference")
          .ascending("sortOrder")
          .limit(1000)
          .find({ useMasterKey: true }),
      ]);

      return {
        dataSource: "live",
        references: referenceObjects.map((reference) => ({
          objectId: reference.id,
          citationText: reference.get("citationText") || "",
          title: reference.get("title") || "",
          authors: reference.get("authors") || "",
          journal: reference.get("journal") || "",
          year: reference.get("year"),
          pmid: reference.get("pmid") || "",
          doi: reference.get("doi") || "",
          createdAt: reference.createdAt,
          updatedAt: reference.updatedAt,
        })),
        questionReferenceLinks: linkObjects.map((link) => ({
          objectId: link.id,
          questionObjectId: link.get("question")?.id || "",
          referenceObjectId: link.get("reference")?.id || "",
        })),
      };
    } catch (error) {
      console.error("Unable to load references.", error);
      return {
        dataSource: "mock",
        references: mockReferences,
        questionReferenceLinks: mockQuestionReferenceLinks,
      };
    }
  }

  async function loadQuestionBankData() {
    const mockData = buildMockQuestionBankData();
    const [liveQuestions, statuses, specialties] = await Promise.all([
      fetchCloudList("listQuestions", mockData.questions),
      fetchCloudList("listStatuses", []),
      fetchCloudList("listSpecialties", []),
    ]);

    const [usersById, mediaPayload, referencePayload] = await Promise.all([
      fetchUsersByIds(
        liveQuestions.flatMap((question) => [
          question?.createdByObjectId || "",
          question?.lastEditedByObjectId || "",
        ]),
        mockData.usersById
      ),
      fetchQuestionMediaRecords(mockData.media),
      fetchReferenceRecords(mockData.references, mockData.questionReferenceLinks),
    ]);

    const referencesByQuestionId = new Map();
    const questionCountByReferenceId = new Map();

    referencePayload.questionReferenceLinks.forEach((link) => {
      const questionObjectId = String(link.questionObjectId || "");
      const referenceObjectId = String(link.referenceObjectId || "");

      if (!referencesByQuestionId.has(questionObjectId)) {
        referencesByQuestionId.set(questionObjectId, []);
      }

      const referenceRecord = referencePayload.references.find(
        (reference) => String(reference.objectId || "") === referenceObjectId
      );
      if (referenceRecord) {
        referencesByQuestionId.get(questionObjectId).push({
          ...referenceRecord,
          searchableText: [
            referenceRecord.citationText,
            referenceRecord.title,
            referenceRecord.authors,
            referenceRecord.journal,
            referenceRecord.pmid,
            referenceRecord.doi,
          ]
            .join(" ")
            .toLowerCase(),
        });
      }

      questionCountByReferenceId.set(referenceObjectId, (questionCountByReferenceId.get(referenceObjectId) || 0) + 1);
    });

    const mediaByQuestionId = new Map();
    mediaPayload.records.forEach((mediaRecord) => {
      const questionObjectId = String(mediaRecord.questionObjectId || "");
      if (!mediaByQuestionId.has(questionObjectId)) {
        mediaByQuestionId.set(questionObjectId, []);
      }
      mediaByQuestionId.get(questionObjectId).push(mediaRecord);
    });

    const questions = liveQuestions.map((question) =>
      normalizeQuestionRecord(question, { referencesByQuestionId, mediaByQuestionId, usersById })
    );
    const questionsById = new Map(questions.map((question) => [question.objectId, question]));
    const media = mediaPayload.records.map((record) => normalizeMediaRecord(record, questionsById, usersById));
    const references = referencePayload.references.map((record) =>
      normalizeReferenceRecord(record, questionCountByReferenceId)
    );

    const liveAiAssets = questions
      .filter((question) => question.generatedByAI || question.aiModel || question.aiPromptVersion)
      .map((question) =>
        normalizeAiAssetRecord({
          objectId: `${question.objectId}-ai`,
          questionId: `Q-${question.idLabel}`,
          assetType: question.generatedByAI ? "Question Draft" : "Prompt Artifact",
          model: question.aiModel || "Unknown",
          promptVersion: question.aiPromptVersion || "—",
          generatedAt: question.lastEditedAt,
          cached: Boolean(question.aiModel),
          needsRegeneration: question.status === "Revision Requested",
        })
      );

    const finalQuestions = questions.length
      ? questions
      : mockData.questions.map((question) =>
          normalizeQuestionRecord(question, {
            referencesByQuestionId,
            mediaByQuestionId,
            usersById: mockData.usersById,
          })
        );
    const finalQuestionsById = new Map(finalQuestions.map((question) => [question.objectId, question]));
    const finalMedia = media.length
      ? media
      : mockData.media.map((record) =>
          normalizeMediaRecord(record, finalQuestionsById, mockData.usersById)
        );
    const finalReferences = references.length
      ? references
      : mockData.references.map((record) => normalizeReferenceRecord(record, questionCountByReferenceId));
    const finalAiAssets = liveAiAssets.length
      ? liveAiAssets
      : mockData.aiAssets.map(normalizeAiAssetRecord);

    questionBankState.datasets.questions = finalQuestions;
    questionBankState.datasets.media = finalMedia;
    questionBankState.datasets.references = finalReferences;
    questionBankState.datasets.aiAssets = finalAiAssets;
    questionBankState.datasets.templates = mockData.templates.map(normalizeTemplateRecord);

    questionBankState.filterOptions.statuses = buildStatusOptions(statuses, questionBankState.datasets.questions);
    questionBankState.filterOptions.specialties = buildSpecialtyOptions(
      specialties,
      questionBankState.datasets.questions
    );
    questionBankState.meta.dataSources.questions =
      questions.length && liveQuestions !== mockData.questions ? "live" : "mock";
    questionBankState.meta.dataSources.media =
      media.length && mediaPayload.dataSource === "live" ? "live" : "mock";
    questionBankState.meta.dataSources.references =
      references.length && referencePayload.dataSource === "live" ? "live" : "mock";
    questionBankState.meta.dataSources.aiAssets = liveAiAssets.length ? "live" : "mock";
    questionBankState.meta.dataSources.templates = "mock";
    questionBankState.loading = false;
  }

  function buildStatusOptions(statuses, questions) {
    const liveStatuses = Array.isArray(statuses)
      ? statuses
          .map((status) => String(status?.name || "").trim())
          .filter(Boolean)
      : [];
    const questionStatuses = questions.map((question) => question.status).filter(Boolean);
    return Array.from(new Set([...QUESTION_BANK_STATUS_ORDER, ...liveStatuses, ...questionStatuses]));
  }

  function buildSpecialtyOptions(specialties, questions) {
    const liveSpecialties = Array.isArray(specialties)
      ? specialties
          .map((specialty) => String(specialty?.name || specialty?.shortName || "").trim())
          .filter(Boolean)
      : [];
    const questionSpecialties = questions.map((question) => question.specialty).filter(Boolean);
    return Array.from(new Set([...liveSpecialties, ...questionSpecialties])).sort((left, right) =>
      left.localeCompare(right, undefined, { sensitivity: "base" })
    );
  }

  function getRoot() {
    return document.getElementById("question-bank-root");
  }

  function getFilteredQuestions() {
    const { search, status, specialty, difficulty } = questionBankState.filterValues;
    return questionBankState.datasets.questions.filter((question) => {
      if (search && !question.searchableText.includes(search.toLowerCase())) {
        return false;
      }

      if (status && question.status !== status) {
        return false;
      }

      if (specialty && question.specialty !== specialty) {
        return false;
      }

      if (difficulty && question.difficulty !== difficulty) {
        return false;
      }

      return true;
    });
  }

  function getFilteredTabRecords() {
    const search = questionBankState.filterValues.search.toLowerCase();
    const matchesSearch = (record) => !search || String(record.searchableText || "").includes(search);

    switch (questionBankState.activeTab) {
      case "media":
        return questionBankState.datasets.media.filter(matchesSearch);
      case "references":
        return questionBankState.datasets.references.filter(matchesSearch);
      case "ai-assets":
        return questionBankState.datasets.aiAssets.filter(matchesSearch);
      case "templates":
        return questionBankState.datasets.templates.filter(matchesSearch);
      case "questions":
      default:
        return getFilteredQuestions();
    }
  }

  function renderFilterControls() {
    const statusSelect = document.getElementById("question-bank-status-filter");
    const specialtySelect = document.getElementById("question-bank-specialty-filter");
    const difficultySelect = document.getElementById("question-bank-difficulty-filter");
    const searchInput = document.getElementById("question-bank-search");
    const filterToggle = document.getElementById("question-bank-filter-toggle");
    const filterRow = document.getElementById("question-bank-filter-row");

    if (searchInput) {
      searchInput.value = questionBankState.filterValues.search;
    }

    if (statusSelect) {
      statusSelect.innerHTML = [
        '<option value="">All statuses</option>',
        ...questionBankState.filterOptions.statuses.map(
          (status) => `<option value="${escapeHtml(status)}">${escapeHtml(status)}</option>`
        ),
      ].join("");
      statusSelect.value = questionBankState.filterValues.status;
    }

    if (specialtySelect) {
      specialtySelect.innerHTML = [
        '<option value="">All specialties</option>',
        ...questionBankState.filterOptions.specialties.map(
          (specialty) => `<option value="${escapeHtml(specialty)}">${escapeHtml(specialty)}</option>`
        ),
      ].join("");
      specialtySelect.value = questionBankState.filterValues.specialty;
    }

    if (difficultySelect) {
      difficultySelect.innerHTML = [
        '<option value="">All difficulty levels</option>',
        ...questionBankState.filterOptions.difficulties.map(
          (difficulty) => `<option value="${escapeHtml(difficulty)}">${escapeHtml(difficulty)}</option>`
        ),
      ].join("");
      difficultySelect.value = questionBankState.filterValues.difficulty;
    }

    if (filterRow) {
      filterRow.classList.toggle("is-collapsed", !questionBankState.filtersExpanded);
    }

    if (filterToggle) {
      filterToggle.setAttribute("aria-expanded", String(questionBankState.filtersExpanded));
    }
  }

  function renderTabs() {
    const tabs = document.querySelectorAll(".question-bank-tab");

    tabs.forEach((tab) => {
      const isActive = tab.dataset.tab === questionBankState.activeTab;
      tab.classList.toggle("is-active", isActive);
      tab.setAttribute("aria-selected", String(isActive));
    });
  }

  function renderFeedback() {
    const feedback = document.getElementById("question-bank-feedback");
    if (!feedback) {
      return;
    }

    if (!questionBankState.feedback.message) {
      feedback.textContent = "";
      feedback.className = "question-bank-feedback hidden";
      return;
    }

    feedback.textContent = questionBankState.feedback.message;
    feedback.className = `question-bank-feedback ${questionBankState.feedback.type}`;
  }

  function renderBulkBar() {
    const bulkBar = document.getElementById("question-bank-bulk-bar");
    if (!bulkBar) {
      return;
    }

    if (questionBankState.activeTab !== "questions" || questionBankState.selectedQuestionIds.size === 0) {
      bulkBar.innerHTML = "";
      bulkBar.classList.add("hidden");
      return;
    }

    bulkBar.innerHTML = `
      <div class="question-bank-bulk-copy">${questionBankState.selectedQuestionIds.size} selected</div>
      <div class="question-bank-bulk-actions">
        <button type="button" class="question-bank-inline-action" data-bulk-action="change-status">Change Status</button>
        <button type="button" class="question-bank-inline-action" data-bulk-action="assign-reviewer">Assign Reviewer</button>
        <button type="button" class="question-bank-inline-action" data-bulk-action="verify-references">Verify References</button>
        <button type="button" class="question-bank-inline-action" data-bulk-action="export-selected">Export Selected</button>
        <button type="button" class="question-bank-inline-action is-danger" data-bulk-action="archive">Archive</button>
      </div>
    `;
    bulkBar.classList.remove("hidden");
  }

  function renderPreviewDrawer() {
    const overlay = document.getElementById("question-bank-preview-overlay");
    const content = document.getElementById("question-bank-preview-content");
    const previewQuestion = getPreviewQuestion();

    if (!overlay || !content) {
      return;
    }

    if (!previewQuestion) {
      overlay.classList.add("hidden");
      overlay.setAttribute("aria-hidden", "true");
      content.innerHTML = "";
      return;
    }

    overlay.classList.remove("hidden");
    overlay.setAttribute("aria-hidden", "false");
    content.innerHTML = `
      <div class="question-bank-preview-header">
        <div>
          <p class="question-bank-preview-eyebrow">Question Preview</p>
          <h3 id="question-bank-preview-title">${escapeHtml(previewQuestion.title)}</h3>
          <p class="question-bank-preview-meta">Question ID ${escapeHtml(previewQuestion.idLabel)}</p>
        </div>
        <button type="button" class="question-bank-preview-close" data-close-preview aria-label="Close preview">×</button>
      </div>

      <div class="question-bank-preview-badges">
        ${renderBadge(previewQuestion.status, "status")}
        ${renderBadge(previewQuestion.difficulty, "difficulty")}
      </div>

      <dl class="question-bank-preview-grid">
        <div>
          <dt>Specialty</dt>
          <dd>${escapeHtml(previewQuestion.specialty)}</dd>
        </div>
        <div>
          <dt>Topic</dt>
          <dd>${escapeHtml(previewQuestion.topic)}</dd>
        </div>
        <div>
          <dt>Author</dt>
          <dd>${escapeHtml(previewQuestion.author)}</dd>
        </div>
        <div>
          <dt>Last edited</dt>
          <dd>${escapeHtml(previewQuestion.lastEditedLabel)}</dd>
        </div>
        <div>
          <dt>References</dt>
          <dd>${escapeHtml(String(previewQuestion.referencesCount))}</dd>
        </div>
        <div>
          <dt>Media</dt>
          <dd>${escapeHtml(String(previewQuestion.mediaCount))}</dd>
        </div>
      </dl>

      <section class="question-bank-preview-section">
        <h4>Question stem preview</h4>
        <p>${escapeHtml(previewQuestion.stem || "No stem available.")}</p>
      </section>

      <section class="question-bank-preview-section">
        <h4>Correct answer</h4>
        <p>${escapeHtml(previewQuestion.correctAnswer)}</p>
      </section>

      <section class="question-bank-preview-section">
        <h4>Critique preview</h4>
        <p>${escapeHtml(previewQuestion.critique || "No critique preview available.")}</p>
      </section>

      <div class="question-bank-preview-actions">
        <button type="button" class="button-primary" data-open-editor="${escapeHtml(previewQuestion.objectId)}">
          Open Full Editor
        </button>
        <button type="button" class="dashboard-toolbar-button" data-close-preview>Close</button>
      </div>
    `;
  }

  function renderBadge(label, kind) {
    const normalizedKind = kind === "difficulty" ? "difficulty" : "status";
    const slug = slugify(label) || "default";
    return `<span class="question-bank-badge question-bank-${normalizedKind}-badge question-bank-${normalizedKind}-${slug}">${escapeHtml(
      label || "Unspecified"
    )}</span>`;
  }

  function renderQuestionsTable(records) {
    const allVisibleSelected =
      records.length > 0 &&
      records.every((question) => questionBankState.selectedQuestionIds.has(question.objectId));

    return `
      <div class="question-bank-table-card">
        <div class="question-bank-table-scroll">
          <table class="question-bank-table">
            <thead>
              <tr>
                <th><input type="checkbox" aria-label="Select all visible questions" data-select-all ${allVisibleSelected ? "checked" : ""} /></th>
                <th>ID</th>
                <th>Title</th>
                <th>Specialty</th>
                <th>Topic</th>
                <th>Status</th>
                <th>Difficulty</th>
                <th>References</th>
                <th>Media</th>
                <th>Last Edited</th>
                <th>Author</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${records
                .map(
                  (question) => `
                    <tr>
                      <td>
                        <input
                          type="checkbox"
                          aria-label="Select ${escapeHtml(question.title)}"
                          data-select-question="${escapeHtml(question.objectId)}"
                          ${questionBankState.selectedQuestionIds.has(question.objectId) ? "checked" : ""}
                        />
                      </td>
                      <td><span class="question-bank-id-pill">${escapeHtml(question.idLabel)}</span></td>
                      <td>
                        <div class="question-bank-primary-cell">
                          <strong>${escapeHtml(question.title)}</strong>
                          <span>${escapeHtml(truncateText(question.stem, 92))}</span>
                        </div>
                      </td>
                      <td>${escapeHtml(question.specialty)}</td>
                      <td>${escapeHtml(question.topic)}</td>
                      <td>${renderBadge(question.status, "status")}</td>
                      <td>${renderBadge(question.difficulty, "difficulty")}</td>
                      <td>${escapeHtml(String(question.referencesCount))}</td>
                      <td>${escapeHtml(String(question.mediaCount))}</td>
                      <td>${escapeHtml(question.lastEditedLabel)}</td>
                      <td>${escapeHtml(question.author)}</td>
                      <td>
                        <div class="question-bank-row-actions">
                          <button type="button" class="question-bank-inline-action" data-row-action="preview" data-question-id="${escapeHtml(question.objectId)}">Preview</button>
                          <button type="button" class="question-bank-inline-action" data-row-action="edit" data-question-id="${escapeHtml(question.objectId)}">Edit</button>
                          <button type="button" class="question-bank-inline-action" data-row-action="duplicate" data-question-id="${escapeHtml(question.objectId)}">Duplicate</button>
                          <button type="button" class="question-bank-inline-action is-danger" data-row-action="archive" data-question-id="${escapeHtml(question.objectId)}">Archive</button>
                        </div>
                      </td>
                    </tr>
                  `
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderMediaTable(records) {
    return `
      <div class="question-bank-table-card">
        <div class="question-bank-table-scroll">
          <table class="question-bank-table">
            <thead>
              <tr>
                <th>Thumbnail</th>
                <th>Type</th>
                <th>Filename</th>
                <th>Linked Question</th>
                <th>Uploaded By</th>
                <th>Upload Date</th>
                <th>Size</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${records
                .map(
                  (record) => `
                    <tr>
                      <td>
                        <div class="question-bank-thumbnail">${escapeHtml(record.type.slice(0, 1))}</div>
                      </td>
                      <td>${escapeHtml(record.type)}</td>
                      <td>${escapeHtml(record.filename)}</td>
                      <td>${escapeHtml(record.linkedQuestion)}</td>
                      <td>${escapeHtml(record.uploadedBy)}</td>
                      <td>${escapeHtml(record.uploadDate)}</td>
                      <td>${escapeHtml(record.size)}</td>
                      <td>${renderBadge(record.status, "status")}</td>
                      <td>
                        <div class="question-bank-row-actions">
                          <button type="button" class="question-bank-inline-action" data-row-action="preview-media" data-record-id="${escapeHtml(record.objectId)}">Preview</button>
                          <button type="button" class="question-bank-inline-action" data-row-action="copy-filename" data-record-id="${escapeHtml(record.objectId)}">Copy Name</button>
                        </div>
                      </td>
                    </tr>
                  `
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderReferencesTable(records) {
    return `
      <div class="question-bank-table-card">
        <div class="question-bank-table-scroll">
          <table class="question-bank-table">
            <thead>
              <tr>
                <th>Citation</th>
                <th>First Author</th>
                <th>Journal</th>
                <th>Year</th>
                <th>PMID</th>
                <th>DOI</th>
                <th>Questions Using</th>
                <th>Last Verified</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${records
                .map(
                  (record) => `
                    <tr>
                      <td>
                        <div class="question-bank-primary-cell">
                          <strong>${escapeHtml(truncateText(record.citation, 90))}</strong>
                        </div>
                      </td>
                      <td>${escapeHtml(record.firstAuthor)}</td>
                      <td>${escapeHtml(record.journal)}</td>
                      <td>${escapeHtml(String(record.year))}</td>
                      <td>${escapeHtml(record.pmid)}</td>
                      <td>${escapeHtml(record.doi)}</td>
                      <td>${escapeHtml(String(record.questionsUsing))}</td>
                      <td>${escapeHtml(record.lastVerified)}</td>
                      <td>${renderBadge(record.status, "status")}</td>
                    </tr>
                  `
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderAiAssetsTable(records) {
    return `
      <div class="question-bank-table-card">
        <div class="question-bank-table-scroll">
          <table class="question-bank-table">
            <thead>
              <tr>
                <th>Question ID</th>
                <th>Asset Type</th>
                <th>Model</th>
                <th>Prompt Version</th>
                <th>Generated At</th>
                <th>Cached</th>
                <th>Needs Regeneration</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${records
                .map(
                  (record) => `
                    <tr>
                      <td>${escapeHtml(record.questionId)}</td>
                      <td>${escapeHtml(record.assetType)}</td>
                      <td>${escapeHtml(record.model)}</td>
                      <td>${escapeHtml(record.promptVersion)}</td>
                      <td>${escapeHtml(record.generatedAt)}</td>
                      <td>${escapeHtml(record.cached)}</td>
                      <td>${escapeHtml(record.needsRegeneration)}</td>
                      <td>
                        <div class="question-bank-row-actions">
                          <button type="button" class="question-bank-inline-action" data-row-action="view-ai-asset" data-record-id="${escapeHtml(record.objectId)}">View</button>
                          <button type="button" class="question-bank-inline-action" data-row-action="regenerate-ai-asset" data-record-id="${escapeHtml(record.objectId)}">Regenerate</button>
                        </div>
                      </td>
                    </tr>
                  `
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderTemplatesTable(records) {
    return `
      <div class="question-bank-table-card">
        <div class="question-bank-table-scroll">
          <table class="question-bank-table">
            <thead>
              <tr>
                <th>Template Name</th>
                <th>Type</th>
                <th>Version</th>
                <th>Last Modified</th>
                <th>Active</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${records
                .map(
                  (record) => `
                    <tr>
                      <td>${escapeHtml(record.templateName)}</td>
                      <td>${escapeHtml(record.type)}</td>
                      <td>${escapeHtml(record.version)}</td>
                      <td>${escapeHtml(record.lastModified)}</td>
                      <td>${renderBadge(record.active === "Yes" ? "Active" : "Inactive", "status")}</td>
                      <td>
                        <div class="question-bank-row-actions">
                          <button type="button" class="question-bank-inline-action" data-row-action="edit-template" data-record-id="${escapeHtml(record.objectId)}">Edit</button>
                          <button type="button" class="question-bank-inline-action" data-row-action="duplicate-template" data-record-id="${escapeHtml(record.objectId)}">Duplicate</button>
                          <button type="button" class="question-bank-inline-action is-danger" data-row-action="deactivate-template" data-record-id="${escapeHtml(record.objectId)}">Deactivate</button>
                        </div>
                      </td>
                    </tr>
                  `
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderEmptyState(copy) {
    return `
      <div class="question-bank-empty-state">
        <h3>No matching records</h3>
        <p>${escapeHtml(copy)}</p>
      </div>
    `;
  }

  function renderCurrentTab() {
    const region = document.getElementById("question-bank-table-region");
    if (!region) {
      return;
    }

    const records = getFilteredTabRecords();
    const sourceMap = {
      questions: questionBankState.meta.dataSources.questions,
      media: questionBankState.meta.dataSources.media,
      references: questionBankState.meta.dataSources.references,
      "ai-assets": questionBankState.meta.dataSources.aiAssets,
      templates: questionBankState.meta.dataSources.templates,
    };
    const sourceNote =
      sourceMap[questionBankState.activeTab] === "mock"
        ? `
            <div class="question-bank-source-note">
              Showing seeded development data for this tab until its live source is connected.
            </div>
          `
        : "";

    if (records.length === 0) {
      region.innerHTML = `${sourceNote}${renderEmptyState(
        "Try adjusting the search or filters for this workspace."
      )}`;
      return;
    }

    if (questionBankState.activeTab === "media") {
      region.innerHTML = `${sourceNote}${renderMediaTable(records)}`;
      return;
    }

    if (questionBankState.activeTab === "references") {
      region.innerHTML = `${sourceNote}${renderReferencesTable(records)}`;
      return;
    }

    if (questionBankState.activeTab === "ai-assets") {
      region.innerHTML = `${sourceNote}${renderAiAssetsTable(records)}`;
      return;
    }

    if (questionBankState.activeTab === "templates") {
      region.innerHTML = `${sourceNote}${renderTemplatesTable(records)}`;
      return;
    }

    region.innerHTML = `${sourceNote}${renderQuestionsTable(records)}`;
  }

  function renderAll() {
    renderFilterControls();
    renderTabs();
    renderFeedback();
    renderBulkBar();
    renderCurrentTab();
    renderPreviewDrawer();
  }

  function closePreviewDrawer() {
    questionBankState.previewQuestionId = "";
    renderPreviewDrawer();
  }

  function openPreviewDrawer(questionId) {
    questionBankState.previewQuestionId = questionId;
    renderPreviewDrawer();
  }

  function toggleQuestionSelection(questionId, isSelected) {
    if (!questionId) {
      return;
    }

    if (isSelected) {
      questionBankState.selectedQuestionIds.add(questionId);
    } else {
      questionBankState.selectedQuestionIds.delete(questionId);
    }

    renderBulkBar();
    renderCurrentTab();
  }

  function toggleVisibleQuestionSelection(isSelected) {
    getFilteredQuestions().forEach((question) => {
      if (isSelected) {
        questionBankState.selectedQuestionIds.add(question.objectId);
      } else {
        questionBankState.selectedQuestionIds.delete(question.objectId);
      }
    });

    renderBulkBar();
    renderCurrentTab();
  }

  async function updateQuestionStatus(questionIds, newStatus) {
    const ids = Array.isArray(questionIds) ? questionIds.filter(Boolean) : [];
    if (!ids.length || !newStatus) {
      return;
    }

    const localDate = new Date().toISOString();
    const selectedQuestions = questionBankState.datasets.questions.filter((question) => ids.includes(question.objectId));

    await Promise.all(
      ids.map(async (questionId) => {
        if (window.back4app && typeof window.back4app.runCloudFunction === "function") {
          try {
            await window.back4app.runCloudFunction("editQuestion", {
              objectId: questionId,
              status: newStatus,
              lastEditedAt: localDate,
            });
          } catch (error) {
            console.error(`Unable to update question ${questionId}.`, error);
          }
        }
      })
    );

    selectedQuestions.forEach((question) => {
      question.status = newStatus;
      question.lastEditedAt = localDate;
      question.lastEditedLabel = formatDateTime(localDate);
      question.searchableText = [
        question.title,
        question.stem,
        question.critique,
        question.specialty,
        question.topic,
        question.status,
        question.difficulty,
        question.author,
      ]
        .join(" ")
        .toLowerCase();
    });
  }

  async function handleArchive(questionIds) {
    await updateQuestionStatus(questionIds, "Archived");
    setFeedback(
      questionIds.length === 1 ? "Question archived." : `${questionIds.length} questions archived.`,
      "success"
    );
    questionIds.forEach((questionId) => {
      questionBankState.selectedQuestionIds.delete(questionId);
    });
    renderAll();
  }

  async function handleDuplicate(questionId) {
    const question = questionBankState.datasets.questions.find((record) => record.objectId === questionId);
    if (!question) {
      return;
    }

    if (window.back4app && typeof window.back4app.runCloudFunction === "function") {
      try {
        await window.back4app.runCloudFunction("saveQuestionBundle", {
          question: {
            stem: question.stem,
            critique: question.critique,
            explanation: question.critique,
            specialty: question.specialty,
            topic: question.topic,
            status: "Draft",
            difficulty: question.difficulty,
            generatedByAI: question.generatedByAI,
            aiModel: question.aiModel,
            aiPromptVersion: question.aiPromptVersion,
          },
          options: question.questionOptions.map((option, index) => ({
            label: option.label || String.fromCharCode(65 + index),
            text: option.text,
            isCorrect: option.isCorrect,
            sortOrder: index,
          })),
          references: question.referenceRecords.map((reference, index) => ({
            title: reference.title || reference.citation,
            authors: reference.firstAuthor || "",
            journal: reference.journal,
            year: Number(reference.year) || undefined,
            pmid: reference.pmid === "—" ? "" : reference.pmid,
            doi: reference.doi === "—" ? "" : reference.doi,
            citationText: reference.citation,
            sortOrder: index,
            isPrimary: index === 0,
          })),
          editHistory: {
            previousStatus: question.status,
            newStatus: "Draft",
            changeSummary: `Duplicated from ${question.idLabel} in Question Bank.`,
          },
        });
        await refreshQuestionBank();
        setFeedback("Question duplicated as a new draft.", "success");
        return;
      } catch (error) {
        console.error("Unable to duplicate question with live data.", error);
      }
    }

    const duplicateId = `local-${Date.now()}`;
    const duplicate = {
      ...question,
      objectId: duplicateId,
      idLabel: duplicateId.slice(-8).toUpperCase(),
      status: "Draft",
      title: `${question.title} (Copy)`,
      lastEditedAt: new Date().toISOString(),
      lastEditedLabel: formatDateTime(new Date()),
    };
    questionBankState.datasets.questions.unshift(duplicate);
    setFeedback("Question duplicated locally for this session.", "success");
    renderAll();
  }

  function exportQuestions(records, filename) {
    const headers = [
      "ID",
      "Title",
      "Specialty",
      "Topic",
      "Status",
      "Difficulty",
      "References",
      "Media",
      "Last Edited",
      "Author",
    ];
    const rows = records.map((question) => [
      question.idLabel,
      question.title,
      question.specialty,
      question.topic,
      question.status,
      question.difficulty,
      question.referencesCount,
      question.mediaCount,
      question.lastEditedLabel,
      question.author,
    ]);
    const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");

    downloadTextFile(filename, csv);
  }

  async function handleBulkAction(actionName) {
    const selectedIds = Array.from(questionBankState.selectedQuestionIds);
    if (!selectedIds.length) {
      return;
    }

    if (actionName === "archive") {
      await handleArchive(selectedIds);
      return;
    }

    if (actionName === "change-status") {
      const nextStatus = window.prompt(
        "Enter the new status for the selected questions:",
        "Needs Review"
      );
      if (nextStatus && nextStatus.trim()) {
        await updateQuestionStatus(selectedIds, nextStatus.trim());
        setFeedback(`Updated ${selectedIds.length} questions to ${nextStatus.trim()}.`, "success");
        renderAll();
      }
      return;
    }

    if (actionName === "export-selected") {
      exportQuestions(getSelectedQuestionRecords(), "sesats-question-bank-selected.csv");
      setFeedback("Selected questions exported.", "success");
      return;
    }

    if (actionName === "assign-reviewer") {
      setFeedback("Reviewer assignment workflow will plug into the next review surface.", "success");
      return;
    }

    if (actionName === "verify-references") {
      setFeedback("Reference verification queued for the selected questions.", "success");
    }
  }

  function handleRowAction(actionName, questionId, recordId) {
    if (actionName === "preview") {
      openPreviewDrawer(questionId);
      return;
    }

    if (actionName === "edit") {
      window.location.href = getQuestionEditUrl(questionId);
      return;
    }

    if (actionName === "duplicate") {
      void handleDuplicate(questionId);
      return;
    }

    if (actionName === "archive") {
      void handleArchive([questionId]);
      return;
    }

    if (actionName === "preview-media") {
      setFeedback("Media preview will open in the asset viewer when that route is connected.", "success");
      return;
    }

    if (actionName === "copy-filename") {
      const record = questionBankState.datasets.media.find((item) => item.objectId === recordId);
      if (record && navigator.clipboard?.writeText) {
        navigator.clipboard
          .writeText(record.filename)
          .then(() => setFeedback("Filename copied to clipboard.", "success"))
          .catch(() => setFeedback("Unable to copy filename.", "error"));
      }
      return;
    }

    if (actionName === "view-ai-asset") {
      setFeedback("AI asset preview will open in the generation review flow.", "success");
      return;
    }

    if (actionName === "regenerate-ai-asset") {
      setFeedback("AI regeneration requested for this artifact.", "success");
      return;
    }

    if (actionName === "edit-template") {
      setFeedback("Template editor is not wired yet, but this row is ready for that route.", "success");
      return;
    }

    if (actionName === "duplicate-template") {
      setFeedback("Template duplicated locally in the workspace roadmap.", "success");
      return;
    }

    if (actionName === "deactivate-template") {
      setFeedback("Template deactivation would be handled by the template service.", "success");
    }
  }

  function bindQuestionBankEvents() {
    const root = getRoot();
    if (!root || questionBankState.listenersBound) {
      return;
    }

    const searchInput = document.getElementById("question-bank-search");
    const statusFilter = document.getElementById("question-bank-status-filter");
    const specialtyFilter = document.getElementById("question-bank-specialty-filter");
    const difficultyFilter = document.getElementById("question-bank-difficulty-filter");
    const filterToggle = document.getElementById("question-bank-filter-toggle");
    const clearFilters = document.getElementById("question-bank-clear-filters");
    const tabs = document.querySelectorAll(".question-bank-tab");
    const tableRegion = document.getElementById("question-bank-table-region");
    const bulkBar = document.getElementById("question-bank-bulk-bar");
    const previewOverlay = document.getElementById("question-bank-preview-overlay");
    const newQuestionButton = document.getElementById("question-bank-new-question");
    const exportButton = document.getElementById("question-bank-export");
    const importButton = document.getElementById("question-bank-import");

    searchInput?.addEventListener("input", (event) => {
      questionBankState.filterValues.search = String(event.target.value || "");
      renderCurrentTab();
      renderBulkBar();
    });

    statusFilter?.addEventListener("change", (event) => {
      questionBankState.filterValues.status = String(event.target.value || "");
      renderAll();
    });

    specialtyFilter?.addEventListener("change", (event) => {
      questionBankState.filterValues.specialty = String(event.target.value || "");
      renderAll();
    });

    difficultyFilter?.addEventListener("change", (event) => {
      questionBankState.filterValues.difficulty = String(event.target.value || "");
      renderAll();
    });

    filterToggle?.addEventListener("click", () => {
      questionBankState.filtersExpanded = !questionBankState.filtersExpanded;
      renderFilterControls();
    });

    clearFilters?.addEventListener("click", () => {
      questionBankState.filterValues = {
        search: "",
        status: "",
        specialty: "",
        difficulty: "",
      };
      renderAll();
    });

    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const nextTab = tab.dataset.tab;
        if (!QUESTION_BANK_TABS.includes(nextTab)) {
          return;
        }

        questionBankState.activeTab = nextTab;
        if (nextTab !== "questions") {
          questionBankState.selectedQuestionIds.clear();
        }
        renderAll();
      });
    });

    tableRegion?.addEventListener("click", (event) => {
      const rowActionButton = event.target.closest("[data-row-action]");
      const openEditorButton = event.target.closest("[data-open-editor]");
      const closePreviewButton = event.target.closest("[data-close-preview]");

      if (closePreviewButton) {
        closePreviewDrawer();
        return;
      }

      if (openEditorButton) {
        window.location.href = getQuestionEditUrl(openEditorButton.dataset.openEditor);
        return;
      }

      if (!rowActionButton) {
        return;
      }

      handleRowAction(
        rowActionButton.dataset.rowAction,
        rowActionButton.dataset.questionId || "",
        rowActionButton.dataset.recordId || ""
      );
    });

    tableRegion?.addEventListener("change", (event) => {
      const questionToggle = event.target.closest("[data-select-question]");
      const selectAllToggle = event.target.closest("[data-select-all]");

      if (questionToggle) {
        toggleQuestionSelection(questionToggle.dataset.selectQuestion, questionToggle.checked);
        return;
      }

      if (selectAllToggle) {
        toggleVisibleQuestionSelection(selectAllToggle.checked);
      }
    });

    bulkBar?.addEventListener("click", (event) => {
      const actionButton = event.target.closest("[data-bulk-action]");
      if (!actionButton) {
        return;
      }

      void handleBulkAction(actionButton.dataset.bulkAction);
    });

    previewOverlay?.addEventListener("click", (event) => {
      if (event.target === previewOverlay) {
        closePreviewDrawer();
      }

      const closeButton = event.target.closest("[data-close-preview]");
      const openEditorButton = event.target.closest("[data-open-editor]");

      if (closeButton) {
        closePreviewDrawer();
      }

      if (openEditorButton) {
        window.location.href = getQuestionEditUrl(openEditorButton.dataset.openEditor);
      }
    });

    document.addEventListener("keydown", handleQuestionBankEscape);

    newQuestionButton?.addEventListener("click", () => {
      window.location.hash = "#questions-add";
    });

    exportButton?.addEventListener("click", () => {
      if (questionBankState.activeTab === "questions") {
        exportQuestions(getFilteredQuestions(), "sesats-question-bank.csv");
        setFeedback("Question bank export created from the current view.", "success");
        return;
      }

      setFeedback("Export is currently wired for the Questions tab.", "success");
    });

    importButton?.addEventListener("click", () => {
      setFeedback("Import workflow placeholder ready for Back4App ingestion hooks.", "success");
    });

    questionBankState.listenersBound = true;
  }

  function handleQuestionBankEscape(event) {
    if (event.key === "Escape" && questionBankState.previewQuestionId) {
      closePreviewDrawer();
    }
  }

  function unbindQuestionBankEvents() {
    document.removeEventListener("keydown", handleQuestionBankEscape);
    questionBankState.listenersBound = false;
  }

  async function refreshQuestionBank() {
    questionBankState.loading = true;
    questionBankState.selectedQuestionIds.clear();
    questionBankState.previewQuestionId = "";
    renderFeedback();
    renderPreviewDrawer();
    renderBulkBar();
    const region = document.getElementById("question-bank-table-region");
    if (region) {
      region.innerHTML = `
        <div class="question-bank-loading-card">
          <div class="question-bank-loading-title">Refreshing question bank...</div>
          <p>Syncing the latest editorial content from Back4App.</p>
        </div>
      `;
    }
    await loadQuestionBankData();
    renderAll();
  }

  async function bindContentPage() {
    const root = getRoot();
    if (!root) {
      return;
    }

    unbindQuestionBankEvents();
    questionBankState = createDefaultState();
    renderFilterControls();
    renderTabs();
    renderFeedback();
    bindQuestionBankEvents();

    try {
      await loadQuestionBankData();
      renderAll();
    } catch (error) {
      console.error("Unable to initialize the Question Bank page.", error);
      questionBankState.loading = false;
      const region = document.getElementById("question-bank-table-region");
      if (region) {
        region.innerHTML = renderEmptyState("We couldn't load the question bank right now. Please try again.");
      }
      setFeedback("Unable to load the question bank.", "error");
    }
  }

  window.bindContentPage = bindContentPage;
})();
