(function () {
  const api = window.QuestionBank;

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
      uploadDate: api.formatShortDate(safeRecord.uploadedAt || safeRecord.createdAt || ""),
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

  function buildStatusOptions(statuses, questions) {
    const liveStatuses = Array.isArray(statuses)
      ? statuses
          .map((status) => String(status?.name || "").trim())
          .filter(Boolean)
      : [];
    const questionStatuses = questions.map((question) => question.status).filter(Boolean);
    return Array.from(new Set([...api.QUESTION_BANK_STATUS_ORDER, ...liveStatuses, ...questionStatuses]));
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

  api.loadQuestionBankData = async function loadQuestionBankData() {
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

    api.state.datasets.questions = finalQuestions;
    api.state.datasets.media = finalMedia;
    api.state.datasets.references = finalReferences;
    api.state.datasets.aiAssets = finalAiAssets;
    api.state.datasets.templates = mockData.templates.map(normalizeTemplateRecord);

    api.state.filterOptions.statuses = buildStatusOptions(statuses, api.state.datasets.questions);
    api.state.filterOptions.specialties = buildSpecialtyOptions(specialties, api.state.datasets.questions);
    api.state.meta.dataSources.questions =
      questions.length && liveQuestions !== mockData.questions ? "live" : "mock";
    api.state.meta.dataSources.media =
      media.length && mediaPayload.dataSource === "live" ? "live" : "mock";
    api.state.meta.dataSources.references =
      references.length && referencePayload.dataSource === "live" ? "live" : "mock";
    api.state.meta.dataSources.aiAssets = liveAiAssets.length ? "live" : "mock";
    api.state.meta.dataSources.templates = "mock";
    api.state.loading = false;
  };

  api.getFilteredQuestions = function getFilteredQuestions() {
    const { search, status, specialty, difficulty } = api.state.filterValues;

    return api.state.datasets.questions.filter((question) => {
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
