import Foundation

enum RewardPoolAllocator {
    static func allocate(
        pool: Int,
        participants: [CompetitionParticipant],
        minimumAnsweredQuestions: Int
    ) -> [RewardAllocation] {
        let eligible = participants.filter {
            $0.score > 0 && $0.answeredQuestions >= minimumAnsweredQuestions
        }
        let totalScore = eligible.reduce(0) { $0 + $1.score }
        guard pool > 0, totalScore > 0 else { return [] }

        struct Draft {
            let participant: CompetitionParticipant
            let exact: Double
            var awarded: Int
            let fraction: Double
        }

        var drafts = eligible.map { participant -> Draft in
            let exact = Double(pool) * Double(participant.score) / Double(totalScore)
            let floorValue = Int(floor(exact))
            return Draft(
                participant: participant,
                exact: exact,
                awarded: floorValue,
                fraction: exact - Double(floorValue)
            )
        }

        let initiallyAwarded = drafts.reduce(0) { $0 + $1.awarded }
        var remainder = pool - initiallyAwarded
        let remainderOrder = drafts.indices.sorted {
            if drafts[$0].fraction == drafts[$1].fraction {
                return drafts[$0].participant.rank < drafts[$1].participant.rank
            }
            return drafts[$0].fraction > drafts[$1].fraction
        }

        var cursor = 0
        while remainder > 0, !remainderOrder.isEmpty {
            let index = remainderOrder[cursor % remainderOrder.count]
            drafts[index].awarded += 1
            remainder -= 1
            cursor += 1
        }

        return drafts
            .map {
                RewardAllocation(
                    participantID: $0.participant.id,
                    participantName: $0.participant.name,
                    rank: $0.participant.rank,
                    competitionScore: $0.participant.score,
                    rewardPoints: $0.awarded,
                    exactShare: $0.exact
                )
            }
            .sorted { $0.rank < $1.rank }
    }
}
