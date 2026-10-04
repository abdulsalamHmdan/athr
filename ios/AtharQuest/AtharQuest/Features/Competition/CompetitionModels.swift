import Foundation

struct QuizChoice: Identifiable, Codable, Equatable {
    let id: Int
    let text: String
}

struct QuranQuizQuestion: Identifiable, Codable, Equatable {
    let id: String
    let prompt: String
    let choices: [QuizChoice]
    let correctChoiceID: Int
    let explanation: String
    let reference: String
    let durationSeconds: Double

    var correctChoice: QuizChoice? {
        choices.first(where: { $0.id == correctChoiceID })
    }
}

struct CompetitionDefinition: Identifiable, Equatable {
    let id: String
    let title: String
    let subtitle: String
    let scheduledAt: Date
    let rewardPool: Int
    let questions: [QuranQuizQuestion]
}

struct CompetitionParticipant: Identifiable, Equatable {
    let id: String
    let name: String
    let initials: String
    let isCurrentUser: Bool
    var score: Int
    var rank: Int
    var previousRank: Int
    var correctAnswers: Int
    var answeredQuestions: Int
    var streak: Int
    var longestStreak: Int
    var rewardPoints: Int

    var rankMovement: Int { previousRank - rank }
}

struct QuestionAnswerResult: Equatable {
    let selectedChoiceID: Int?
    let correctChoiceID: Int
    let wasCorrect: Bool
    let scoreEarned: Int
    let responseSeconds: Double?
    let oldRank: Int
    let newRank: Int

    var rankMovement: Int { oldRank - newRank }
}

struct RewardAllocation: Identifiable, Equatable {
    let participantID: String
    let participantName: String
    let rank: Int
    let competitionScore: Int
    let rewardPoints: Int
    let exactShare: Double

    var id: String { participantID }
}

enum LiveCompetitionPhase: Equatable {
    case lobby
    case question
    case reveal
    case leaderboard
    case final
}

enum CompetitionSchedule {
    static func nextFriday(hour: Int = 20, minute: Int = 30, from date: Date = .now) -> Date {
        var calendar = Calendar(identifier: .gregorian)
        calendar.locale = Locale(identifier: "ar_SA")
        calendar.timeZone = TimeZone(identifier: "Asia/Riyadh") ?? .current

        let weekday = calendar.component(.weekday, from: date)
        let friday = 6
        var daysAhead = (friday - weekday + 7) % 7

        let todayCandidate = calendar.date(
            bySettingHour: hour,
            minute: minute,
            second: 0,
            of: date
        ) ?? date

        if daysAhead == 0 && todayCandidate <= date {
            daysAhead = 7
        }

        let targetDay = calendar.date(byAdding: .day, value: daysAhead, to: date) ?? date
        return calendar.date(bySettingHour: hour, minute: minute, second: 0, of: targetDay) ?? targetDay
    }
}

enum QuranQuestionBank {
    #if DEBUG
    static let fridayCompetition = CompetitionDefinition(
        id: "friday-quran-live-01",
        title: "مسابقة الجمعة القرآنية",
        subtitle: "صحة الإجابة وسرعتها تصنعان ترتيبك",
        scheduledAt: CompetitionSchedule.nextFriday(),
        rewardPool: 50_000,
        questions: [
            question(
                id: "q1",
                prompt: "كم عدد سور القرآن الكريم؟",
                answers: ["١١٠ سور", "١١٢ سورة", "١١٤ سورة", "١٢٠ سورة"],
                correct: 2,
                explanation: "يضم المصحف الشريف ١١٤ سورة، تبدأ بالفاتحة وتنتهي بالناس.",
                reference: "فهرس سور المصحف الشريف"
            ),
            question(
                id: "q2",
                prompt: "ما السورة الأولى في ترتيب المصحف؟",
                answers: ["البقرة", "الفاتحة", "العلق", "الناس"],
                correct: 1,
                explanation: "سورة الفاتحة هي أول سور المصحف، وتليها سورة البقرة.",
                reference: "ترتيب سور المصحف"
            ),
            question(
                id: "q3",
                prompt: "في أي سورة توجد آية الكرسي؟",
                answers: ["آل عمران", "البقرة", "النساء", "المائدة"],
                correct: 1,
                explanation: "آية الكرسي هي الآية ٢٥٥ من سورة البقرة.",
                reference: "سورة البقرة: ٢٥٥"
            ),
            question(
                id: "q4",
                prompt: "أي سورة لا تبدأ بالبسملة؟",
                answers: ["الأنفال", "يونس", "التوبة", "هود"],
                correct: 2,
                explanation: "سورة التوبة هي السورة الوحيدة التي لا تبدأ ببسم الله الرحمن الرحيم.",
                reference: "بداية سورة التوبة"
            ),
            question(
                id: "q5",
                prompt: "في أي سورة وردت البسملة مرتين؟",
                answers: ["النمل", "النحل", "العنكبوت", "القصص"],
                correct: 0,
                explanation: "وردت البسملة في أول سورة النمل، وداخلها في كتاب سليمان عليه السلام.",
                reference: "سورة النمل: ٣٠"
            ),
            question(
                id: "q6",
                prompt: "في أي شهر أنزل القرآن؟",
                answers: ["محرم", "رجب", "شعبان", "رمضان"],
                correct: 3,
                explanation: "قال تعالى: ﴿شهر رمضان الذي أنزل فيه القرآن﴾.",
                reference: "سورة البقرة: ١٨٥"
            ),
            question(
                id: "q7",
                prompt: "في أي سورة وردت قصة أصحاب الكهف؟",
                answers: ["مريم", "الكهف", "الإسراء", "طه"],
                correct: 1,
                explanation: "وردت قصة الفتية أصحاب الكهف في السورة التي سميت باسمهم.",
                reference: "سورة الكهف: ٩–٢٦"
            ),
            question(
                id: "q8",
                prompt: "أكمل: ليلة القدر خير من…",
                answers: ["مئة شهر", "ألف شهر", "ألف يوم", "عشر سنين"],
                correct: 1,
                explanation: "قال تعالى: ﴿ليلة القدر خير من ألف شهر﴾.",
                reference: "سورة القدر: ٣"
            ),
            question(
                id: "q9",
                prompt: "في أي سورة توجد آية الدَّين، أطول آية في القرآن؟",
                answers: ["البقرة", "النساء", "المائدة", "النور"],
                correct: 0,
                explanation: "آية الدين هي الآية ٢٨٢ من سورة البقرة.",
                reference: "سورة البقرة: ٢٨٢"
            ),
            question(
                id: "q10",
                prompt: "بأي سورة يبدأ جزء عمَّ؟",
                answers: ["النازعات", "عبس", "النبأ", "التكوير"],
                correct: 2,
                explanation: "يبدأ الجزء الثلاثون بسورة النبأ: ﴿عم يتساءلون﴾.",
                reference: "بداية الجزء الثلاثين"
            ),
            question(
                id: "q11",
                prompt: "أي سورة تبدأ بقوله تعالى: ﴿قل هو الله أحد﴾؟",
                answers: ["الفلق", "الناس", "الكافرون", "الإخلاص"],
                correct: 3,
                explanation: "هذه الآية هي بداية سورة الإخلاص.",
                reference: "سورة الإخلاص: ١"
            ),
            question(
                id: "q12",
                prompt: "ما آخر سورة في ترتيب المصحف؟",
                answers: ["الفلق", "الإخلاص", "النصر", "الناس"],
                correct: 3,
                explanation: "سورة الناس هي السورة رقم ١١٤ وآخر سور المصحف ترتيبًا.",
                reference: "ترتيب سور المصحف"
            )
        ]
    )

    #else
    static let fridayCompetition = CompetitionDefinition(id: "demo-disabled", title: "المسابقات", subtitle: "", scheduledAt: Date(), rewardPool: 0, questions: [])
    #endif

    private static func question(
        id: String,
        prompt: String,
        answers: [String],
        correct: Int,
        explanation: String,
        reference: String
    ) -> QuranQuizQuestion {
        QuranQuizQuestion(
            id: id,
            prompt: prompt,
            choices: answers.enumerated().map { QuizChoice(id: $0.offset, text: $0.element) },
            correctChoiceID: correct,
            explanation: explanation,
            reference: reference,
            durationSeconds: 12
        )
    }
}
