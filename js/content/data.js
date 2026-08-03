(function () {
  const api = window.QuestionBank;

  // Populated once by loadQuestionBankSupportData() and read by loadQuestionsPage()
  // whenever it normalizes a page of questions - keeps reference/media counts
  // correct without re-fetching the full reference/media tables per page.
  const questionLookup = {
    referencesByQuestionId: new Map(),
    mediaByQuestionId: new Map(),
  };

  function normalizeQuestionOption(option) {
    const safeOption = option && typeof option === "object" ? option : {};
    return {
      label: String(safeOption.label || "").trim(),
      text: String(safeOption.text || "").trim(),
      isCorrect: safeOption.isCorrect === true,
    };
  }

  function deriveQuestionTitle(stem, topic, specialty) {
    const compactStem = api.truncateText(stem, 78);

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
      lastEditedLabel: api.formatDateTime(
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

  function normalizeMediaRecord(record, questionTitlesById, usersById) {
    const safeRecord = record && typeof record === "object" ? record : {};
    const linkedQuestionId = String(safeRecord.questionObjectId || "");
    const linkedTitle = questionTitlesById.get(linkedQuestionId) || null;
    const fileName = String(safeRecord.fileName || safeRecord.fileKey || "")
      .split("/")
      .pop();
    const usageStatus = linkedQuestionId ? "Used" : "Unused / orphaned";

    return {
      objectId: String(safeRecord.objectId || `${linkedQuestionId}-${fileName}`),
      thumbnail: String(safeRecord.thumbnail || safeRecord.publicUrl || ""),
      type: String(safeRecord.mediaType || "IMAGE"),
      filename: fileName || "Unnamed asset",
      linkedQuestion: linkedTitle || "Not linked",
      linkedQuestionId,
      uploadedBy:
        usersById.get(String(safeRecord.uploadedByObjectId || "")) || safeRecord.uploadedBy || "Editorial Team",
      uploadDate: api.formatShortDate(safeRecord.uploadedAt || safeRecord.createdAt || ""),
      size: String(safeRecord.sizeLabel || safeRecord.size || "Unknown"),
      status: usageStatus,
      searchableText: [
        fileName,
        safeRecord.mediaType,
        linkedTitle,
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
    if (Number.isFinite(year) && year > 0 && year <= api.CURRENT_YEAR - 8) {
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
      lastVerified: api.formatShortDate(safeRecord.updatedAt || safeRecord.createdAt || ""),
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
      generatedAt: api.formatDateTime(safeRecord.generatedAt || safeRecord.updatedAt || ""),
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
      lastModified: api.formatDateTime(safeRecord.lastModified || safeRecord.updatedAt || ""),
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

  function hasCloudFunctions() {
    return Boolean(window.back4app && typeof window.back4app.runCloudFunction === "function");
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

  async function fetchQuestionTitlesByIds(questionIds) {
    const titlesById = new Map();
    const uniqueIds = Array.from(new Set((questionIds || []).filter(Boolean)));

    if (!uniqueIds.length || typeof Parse === "undefined") {
      return titlesById;
    }

    try {
      const Question = Parse.Object.extend("Question");
      const query = new Parse.Query(Question);
      query.containedIn("objectId", uniqueIds);
      query.select("stem", "specialty", "topic");
      query.limit(uniqueIds.length);

      const questions = await query.find({ useMasterKey: true });
      questions.forEach((question) => {
        titlesById.set(
          question.id,
          deriveQuestionTitle(question.get("stem"), question.get("topic"), question.get("specialty"))
        );
      });
    } catch (error) {
      console.error("Unable to load linked question titles.", error);
    }

    return titlesById;
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

  async function fetchQuestionFilterOptions() {
    if (!hasCloudFunctions()) {
      return null;
    }

    try {
      return await window.back4app.runCloudFunction("getQuestionFilterOptions");
    } catch (error) {
      console.error("Unable to load question filter options.", error);
      return null;
    }
  }

  async function fetchGeneratedQuestions(mockAiAssets) {
    if (typeof Parse === "undefined") {
      return { dataSource: "mock", records: mockAiAssets.map(normalizeAiAssetRecord) };
    }

    try {
      const Question = Parse.Object.extend("Question");
      const query = new Parse.Query(Question);
      query.equalTo("generatedByAI", true);
      query.select("stem", "specialty", "topic", "status", "difficulty", "aiModel", "aiPromptVersion", "lastEditedAt");
      query.descending("updatedAt");
      query.limit(1000);

      const records = await query.find({ useMasterKey: true });
      return {
        dataSource: "live",
        records: records.map((record) =>
          normalizeAiAssetRecord({
            objectId: `${record.id}-ai`,
            questionId: `Q-${record.id.slice(-8).toUpperCase()}`,
            assetType: "Question Draft",
            model: record.get("aiModel") || "Unknown",
            promptVersion: record.get("aiPromptVersion") || "—",
            generatedAt: record.get("lastEditedAt") || record.updatedAt,
            cached: Boolean(record.get("aiModel")),
            needsRegeneration: record.get("status") === "Revision Requested",
          })
        ),
      };
    } catch (error) {
      console.error("Unable to load AI-generated questions.", error);
      return { dataSource: "mock", records: mockAiAssets.map(normalizeAiAssetRecord) };
    }
  }

  function buildStatusFilterOptions(rawStatuses) {
    const liveStatuses = Array.isArray(rawStatuses) ? rawStatuses.filter(Boolean) : [];
    if (!liveStatuses.length) {
      return [...api.QUESTION_BANK_STATUS_ORDER];
    }

    const knownFirst = api.QUESTION_BANK_STATUS_ORDER.filter((status) => liveStatuses.includes(status));
    const extras = liveStatuses.filter((status) => !api.QUESTION_BANK_STATUS_ORDER.includes(status)).sort();
    return [...knownFirst, ...extras];
  }

  function buildQuestionListFilters() {
    const { search, status, specialty, difficulty } = api.state.filterValues;
    return {
      searchTerm: search,
      specialty,
      section: "",
      editorStatus: status,
      difficulty,
      sortKey: "default",
    };
  }

  function normalizeQuestionPage(rawQuestions, usersById) {
    return rawQuestions.map((question) =>
      normalizeQuestionRecord(question, {
        referencesByQuestionId: questionLookup.referencesByQuestionId,
        mediaByQuestionId: questionLookup.mediaByQuestionId,
        usersById,
      })
    );
  }

  // Loads everything the Question Bank needs EXCEPT the paginated question
  // rows: media, references, filter option lists, and the AI Assets tab
  // (sourced from a dedicated generatedByAI query rather than the full question
  // set, since that set is no longer loaded wholesale). Call once per page
  // bind/refresh; loadQuestionsPage() handles the Questions tab separately.
  api.loadQuestionBankSupportData = async function loadQuestionBankSupportData() {
    const mockData = buildMockQuestionBankData();

    const [filterOptions, mediaPayload, referencePayload, aiAssetsPayload] = await Promise.all([
      fetchQuestionFilterOptions(),
      fetchQuestionMediaRecords(mockData.media),
      fetchReferenceRecords(mockData.references, mockData.questionReferenceLinks),
      fetchGeneratedQuestions(mockData.aiAssets),
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

      questionCountByReferenceId.set(
        referenceObjectId,
        (questionCountByReferenceId.get(referenceObjectId) || 0) + 1
      );
    });

    const mediaByQuestionId = new Map();
    mediaPayload.records.forEach((mediaRecord) => {
      const questionObjectId = String(mediaRecord.questionObjectId || "");
      if (!mediaByQuestionId.has(questionObjectId)) {
        mediaByQuestionId.set(questionObjectId, []);
      }

      mediaByQuestionId.get(questionObjectId).push(mediaRecord);
    });

    questionLookup.referencesByQuestionId = referencesByQuestionId;
    questionLookup.mediaByQuestionId = mediaByQuestionId;

    // fetchQuestionTitlesByIds queries the real Question class, so it can only
    // resolve live media's linked-question titles - mock media links to
    // synthetic ids (e.g. "qbmock001") that were never written to Parse, so
    // those titles come from the in-memory mock question list instead.
    const questionTitlesById =
      mediaPayload.dataSource === "live"
        ? await fetchQuestionTitlesByIds(mediaPayload.records.map((record) => record.questionObjectId))
        : new Map(
            mockData.questions.map((question) => [
              question.objectId,
              deriveQuestionTitle(question.stem, question.topic, question.specialty),
            ])
          );

    api.state.datasets.references = referencePayload.references.map((record) =>
      normalizeReferenceRecord(record, questionCountByReferenceId)
    );
    api.state.datasets.media = mediaPayload.records.map((record) =>
      normalizeMediaRecord(record, questionTitlesById, new Map())
    );
    api.state.datasets.aiAssets = aiAssetsPayload.records;
    api.state.datasets.templates = mockData.templates.map(normalizeTemplateRecord);

    api.state.filterOptions.statuses = buildStatusFilterOptions(filterOptions?.statuses);
    api.state.filterOptions.specialties =
      Array.isArray(filterOptions?.specialties) && filterOptions.specialties.length
        ? filterOptions.specialties
        : Array.from(new Set(mockData.questions.map((question) => question.specialty).filter(Boolean))).sort();

    api.state.meta.dataSources.references = referencePayload.dataSource;
    api.state.meta.dataSources.media = mediaPayload.dataSource;
    api.state.meta.dataSources.aiAssets = aiAssetsPayload.dataSource;
    api.state.meta.dataSources.templates = "mock";
  };

  // Loads one page of the Questions tab via the same server-paginated
  // listQuestionsPage cloud function the List Questions page uses, instead of
  // pulling the whole (up to 1000-row) table and filtering client-side.
  api.loadQuestionsPage = async function loadQuestionsPage() {
    const requestId = api.state.questionRequestId + 1;
    api.state.questionRequestId = requestId;

    const region = document.getElementById("question-bank-table-region");
    if (api.state.activeTab === "questions" && region) {
      region.innerHTML = `
        <div class="question-bank-loading-card">
          <div class="question-bank-loading-title">Loading questions...</div>
          <p>Applying the current search and filters.</p>
        </div>
      `;
    }

    const mockData = buildMockQuestionBankData();
    const filters = buildQuestionListFilters();

    if (!hasCloudFunctions()) {
      if (requestId !== api.state.questionRequestId) {
        return;
      }

      api.state.datasets.questions = normalizeQuestionPage(mockData.questions, new Map(mockData.usersById));
      api.state.questionPagination = {
        page: 1,
        pageSize: api.state.questionPagination.pageSize,
        totalCount: mockData.questions.length,
        totalPages: 1,
      };
      api.state.meta.dataSources.questions = "mock";
      api.state.loading = false;
      api.renderCurrentTab();
      api.renderBulkBar();
      return;
    }

    try {
      const response = await window.back4app.runCloudFunction("listQuestionsPage", {
        page: api.state.questionPagination.page,
        pageSize: api.state.questionPagination.pageSize,
        filters,
      });

      if (requestId !== api.state.questionRequestId) {
        return;
      }

      const rawQuestions = Array.isArray(response?.questions) ? response.questions : [];
      const usersById = await fetchUsersByIds(
        rawQuestions.flatMap((question) => [
          question?.createdByObjectId || "",
          question?.lastEditedByObjectId || "",
        ]),
        mockData.usersById
      );

      if (requestId !== api.state.questionRequestId) {
        return;
      }

      api.state.datasets.questions = normalizeQuestionPage(rawQuestions, usersById);
      api.state.questionPagination = {
        page: Number(response?.page) || 1,
        pageSize: Number(response?.pageSize) || api.state.questionPagination.pageSize,
        totalCount: Number(response?.totalCount) || 0,
        totalPages: Number(response?.totalPages) || 1,
      };
      api.state.meta.dataSources.questions = "live";
      api.state.loading = false;
      api.renderCurrentTab();
      api.renderBulkBar();
    } catch (error) {
      if (requestId !== api.state.questionRequestId) {
        return;
      }

      console.error("Unable to load the question bank page.", error);
      api.state.datasets.questions = [];
      api.state.loading = false;

      if (api.state.activeTab === "questions" && region) {
        region.innerHTML = api.renderEmptyState("We couldn't load questions right now. Please try again.");
      }

      api.setFeedback("Unable to load questions.", "error");
    }
  };

  // Walks every page of listQuestionsPage for the current filters so "Export"
  // can produce a CSV of all matching questions, not just the visible page.
  api.fetchAllMatchingQuestions = async function fetchAllMatchingQuestions() {
    if (!hasCloudFunctions()) {
      return api.state.datasets.questions.slice();
    }

    const filters = buildQuestionListFilters();
    const pageSize = 100;

    const firstResponse = await window.back4app.runCloudFunction("listQuestionsPage", {
      page: 1,
      pageSize,
      filters,
    });

    const totalPages = Math.max(1, Number(firstResponse?.totalPages) || 1);
    const remainingPages = Array.from({ length: totalPages - 1 }, (_, index) => index + 2);

    const remainingResponses = await Promise.all(
      remainingPages.map((page) =>
        window.back4app.runCloudFunction("listQuestionsPage", { page, pageSize, filters })
      )
    );

    const rawQuestions = [firstResponse, ...remainingResponses].flatMap((response) =>
      Array.isArray(response?.questions) ? response.questions : []
    );

    const usersById = await fetchUsersByIds(
      rawQuestions.flatMap((question) => [
        question?.createdByObjectId || "",
        question?.lastEditedByObjectId || "",
      ]),
      []
    );

    return normalizeQuestionPage(rawQuestions, usersById);
  };

  api.getFilteredQuestions = function getFilteredQuestions() {
    // listQuestionsPage already applied search/status/specialty/difficulty
    // server-side, so the loaded page needs no further client-side filtering.
    return api.state.datasets.questions;
  };

  api.getFilteredTabRecords = function getFilteredTabRecords() {
    const search = api.state.filterValues.search.toLowerCase();
    const matchesSearch = (record) => !search || String(record.searchableText || "").includes(search);

    switch (api.state.activeTab) {
      case "media":
        return api.state.datasets.media.filter(matchesSearch);
      case "references":
        return api.state.datasets.references.filter(matchesSearch);
      case "ai-assets":
        return api.state.datasets.aiAssets.filter(matchesSearch);
      case "templates":
        return api.state.datasets.templates.filter(matchesSearch);
      case "questions":
      default:
        return api.getFilteredQuestions();
    }
  };
})();
