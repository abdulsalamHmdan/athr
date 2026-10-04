import Combine
import Foundation

enum GridDirection: Int, CaseIterable, Codable, Hashable {
    case north = 0
    case east = 1
    case south = 2
    case west = 3

    var opposite: GridDirection {
        GridDirection(rawValue: (rawValue + 2) % 4)!
    }

    var rowDelta: Int {
        switch self {
        case .north: -1
        case .south: 1
        case .east, .west: 0
        }
    }

    var columnDelta: Int {
        switch self {
        case .east: 1
        case .west: -1
        case .north, .south: 0
        }
    }

    func rotated(clockwiseTurns: Int) -> GridDirection {
        GridDirection(rawValue: (rawValue + clockwiseTurns).positiveModulo(4))!
    }
}

private extension Int {
    func positiveModulo(_ divisor: Int) -> Int {
        let result = self % divisor
        return result >= 0 ? result : result + divisor
    }
}

struct GridCoordinate: Hashable, Codable {
    let row: Int
    let column: Int

    func neighbor(toward direction: GridDirection) -> GridCoordinate {
        GridCoordinate(
            row: row + direction.rowDelta,
            column: column + direction.columnDelta
        )
    }

    func direction(to other: GridCoordinate) -> GridDirection? {
        GridDirection.allCases.first {
            neighbor(toward: $0) == other
        }
    }
}

enum PipeKind: String, Codable, Equatable {
    case straight
    case elbow
    case tee
    case cap
    case cross
    case empty

    var baseOpenings: Set<GridDirection> {
        switch self {
        case .straight: [.north, .south]
        case .elbow: [.north, .east]
        case .tee: [.north, .east, .west]
        case .cap: [.north]
        case .cross: Set(GridDirection.allCases)
        case .empty: []
        }
    }
}

struct PipeTile: Identifiable, Codable, Equatable {
    let id: String
    let coordinate: GridCoordinate
    let kind: PipeKind
    var rotation: Int
    let targetRotation: Int?
    let isLocked: Bool
    let isOnSolutionPath: Bool
    let role: TileRole

    enum TileRole: String, Codable, Equatable {
        case normal
        case source
        case goal
    }

    var openings: Set<GridDirection> {
        Set(kind.baseOpenings.map { $0.rotated(clockwiseTurns: rotation) })
    }

    var isCorrectlyOriented: Bool {
        guard let targetRotation else { return false }
        return rotation.positiveModulo(4) == targetRotation.positiveModulo(4)
    }
}

struct PuzzleLevel: Identifiable, Equatable {
    let id: Int
    let title: String
    let size: Int
    let path: [GridCoordinate]
    let scramble: [Int]
    let challengeSeconds: Int

    var subtitle: String {
        switch id {
        case 1...3: "بداية النبع"
        case 4...6: "بين النخيل"
        case 7...9: "مجرى الوادي"
        default: "واحة عامرة"
        }
    }

    static let all: [PuzzleLevel] = [
        PuzzleLevel(
            id: 1,
            title: "أول قطرة",
            size: 5,
            path: coordinates([(4, 0), (4, 1), (3, 1), (2, 1), (2, 2), (2, 3), (1, 3), (0, 3)]),
            scramble: [1, 2, 3, 1, 2, 1],
            challengeSeconds: 75
        ),
        PuzzleLevel(
            id: 2,
            title: "غصن جديد",
            size: 5,
            path: coordinates([(4, 4), (3, 4), (3, 3), (3, 2), (2, 2), (1, 2), (1, 1), (0, 1)]),
            scramble: [3, 1, 2, 3, 2, 1],
            challengeSeconds: 72
        ),
        PuzzleLevel(
            id: 3,
            title: "الدرب الأخضر",
            size: 5,
            path: coordinates([(4, 0), (3, 0), (2, 0), (2, 1), (1, 1), (1, 2), (2, 2), (3, 2), (3, 3), (2, 3), (1, 3), (0, 3)]),
            scramble: [1, 3, 2, 1, 2, 3, 1, 2, 1, 3],
            challengeSeconds: 88
        ),
        PuzzleLevel(
            id: 4,
            title: "ظل النخلة",
            size: 5,
            path: coordinates([(0, 0), (1, 0), (1, 1), (2, 1), (3, 1), (3, 2), (3, 3), (4, 3), (4, 4)]),
            scramble: [2, 1, 3, 1, 2, 3, 1],
            challengeSeconds: 78
        ),
        PuzzleLevel(
            id: 5,
            title: "منعطف الوادي",
            size: 5,
            path: coordinates([(4, 4), (4, 3), (3, 3), (2, 3), (2, 2), (2, 1), (3, 1), (3, 0), (2, 0), (1, 0), (0, 0)]),
            scramble: [1, 2, 3, 2, 1, 3, 2, 1, 3],
            challengeSeconds: 84
        ),
        PuzzleLevel(
            id: 6,
            title: "عين الماء",
            size: 5,
            path: coordinates([(0, 4), (1, 4), (1, 3), (1, 2), (2, 2), (2, 1), (3, 1), (4, 1), (4, 0)]),
            scramble: [3, 2, 1, 3, 1, 2, 3],
            challengeSeconds: 76
        ),
        PuzzleLevel(
            id: 7,
            title: "ثلاث نخلات",
            size: 5,
            path: coordinates([(4, 0), (4, 1), (3, 1), (3, 2), (2, 2), (1, 2), (1, 3), (2, 3), (3, 3), (3, 4), (2, 4), (1, 4), (0, 4)]),
            scramble: [1, 3, 2, 1, 2, 3, 1, 3, 2, 1, 3],
            challengeSeconds: 96
        ),
        PuzzleLevel(
            id: 8,
            title: "مجرى بعيد",
            size: 5,
            path: coordinates([(0, 0), (0, 1), (1, 1), (1, 2), (2, 2), (2, 3), (1, 3), (1, 4), (2, 4), (3, 4), (4, 4)]),
            scramble: [2, 1, 3, 2, 1, 3, 2, 1, 3],
            challengeSeconds: 85
        ),
        PuzzleLevel(
            id: 9,
            title: "قلب الواحة",
            size: 5,
            path: coordinates([(4, 2), (3, 2), (3, 1), (2, 1), (1, 1), (1, 2), (1, 3), (2, 3), (3, 3), (3, 4), (2, 4), (1, 4), (0, 4)]),
            scramble: [1, 2, 3, 1, 3, 2, 1, 2, 3, 1, 2],
            challengeSeconds: 92
        ),
        PuzzleLevel(
            id: 10,
            title: "ماء ونور",
            size: 5,
            path: coordinates([(0, 2), (1, 2), (1, 1), (2, 1), (2, 0), (3, 0), (4, 0), (4, 1), (4, 2), (3, 2), (3, 3), (2, 3), (1, 3), (0, 3)]),
            scramble: [3, 1, 2, 3, 1, 2, 1, 3, 2, 1, 3, 2],
            challengeSeconds: 100
        ),
        PuzzleLevel(
            id: 11,
            title: "الجدول الكبير",
            size: 5,
            path: coordinates([(4, 4), (4, 3), (3, 3), (3, 2), (4, 2), (4, 1), (3, 1), (2, 1), (2, 2), (1, 2), (1, 3), (2, 3), (2, 4), (1, 4), (0, 4)]),
            scramble: [1, 2, 3, 1, 2, 3, 2, 1, 3, 2, 1, 3, 2],
            challengeSeconds: 108
        ),
        PuzzleLevel(
            id: 12,
            title: "الواحة العامرة",
            size: 5,
            path: coordinates([(4, 0), (3, 0), (3, 1), (4, 1), (4, 2), (3, 2), (2, 2), (2, 1), (1, 1), (1, 2), (1, 3), (2, 3), (3, 3), (3, 4), (2, 4), (1, 4), (0, 4)]),
            scramble: [2, 1, 3, 2, 1, 3, 1, 2, 3, 2, 1, 3, 2, 1, 3],
            challengeSeconds: 120
        )
    ]

    private static func coordinates(_ pairs: [(Int, Int)]) -> [GridCoordinate] {
        pairs.map { GridCoordinate(row: $0.0, column: $0.1) }
    }
}

enum PuzzleStatus: Equatable {
    case ready
    case playing
    case won
    case lost
}

final class PipePuzzleEngine: ObservableObject {
    let level: PuzzleLevel
    let playStyle: PlayStyle
    private let optimalRotationsAtStart: Int

    @Published private(set) var tiles: [PipeTile] = []
    @Published private(set) var status: PuzzleStatus = .ready
    @Published private(set) var elapsedSeconds = 0
    @Published private(set) var rotationCount = 0
    @Published private(set) var hintCount = 0
    @Published private(set) var highlightedTileID: String?

    init(level: PuzzleLevel, playStyle: PlayStyle) {
        self.level = level
        self.playStyle = playStyle
        let builtTiles = Self.buildTiles(for: level)
        self.tiles = builtTiles
        self.optimalRotationsAtStart = Self.optimalRotations(in: builtTiles)
    }

    var sourceTile: PipeTile? { tiles.first(where: { $0.role == .source }) }
    var goalTile: PipeTile? { tiles.first(where: { $0.role == .goal }) }

    var flowedTileIDs: Set<String> {
        Self.connectedTileIDs(in: tiles, size: level.size)
    }

    var remainingSeconds: Int {
        max(level.challengeSeconds - elapsedSeconds, 0)
    }

    var starRating: Int {
        if playStyle == .challenge {
            let ratio = Double(remainingSeconds) / Double(level.challengeSeconds)
            if ratio >= 0.5 && hintCount == 0 { return 3 }
            if ratio >= 0.18 && hintCount <= 1 { return 2 }
            return 1
        }

        let optimal = max(optimalRotationsAtStart, 1)
        if rotationCount <= optimal + 3 && hintCount == 0 { return 3 }
        if rotationCount <= optimal + 10 && hintCount <= 2 { return 2 }
        return 1
    }

    func startIfNeeded() {
        if status == .ready { status = .playing }
    }

    func rotate(tileID: String) {
        startIfNeeded()
        guard status == .playing,
              let index = tiles.firstIndex(where: { $0.id == tileID }),
              !tiles[index].isLocked,
              tiles[index].kind != .empty else { return }

        tiles[index].rotation = (tiles[index].rotation + 1).positiveModulo(4)
        rotationCount += 1
        highlightedTileID = nil
        evaluateWin()
    }

    func tick() {
        guard status == .playing else { return }
        elapsedSeconds += 1
        if playStyle == .challenge && remainingSeconds <= 0 {
            status = .lost
        }
    }

    func useHint() {
        startIfNeeded()
        guard status == .playing else { return }
        let limit = playStyle == .calm ? 4 : 2
        guard hintCount < limit else { return }

        guard let index = tiles.firstIndex(where: {
            $0.isOnSolutionPath && !$0.isLocked && !$0.isCorrectlyOriented
        }), let target = tiles[index].targetRotation else {
            return
        }

        highlightedTileID = tiles[index].id
        tiles[index].rotation = target
        hintCount += 1
        evaluateWin()
    }

    func reset() {
        tiles = Self.buildTiles(for: level)
        status = .ready
        elapsedSeconds = 0
        rotationCount = 0
        hintCount = 0
        highlightedTileID = nil
    }

    func retryAfterLoss() {
        reset()
        status = .playing
    }

    private static func optimalRotations(in tiles: [PipeTile]) -> Int {
        tiles.reduce(into: 0) { total, tile in
            guard !tile.isLocked, let target = tile.targetRotation else { return }
            total += (target - tile.rotation).positiveModulo(4)
        }
    }

    private func evaluateWin() {
        guard let goalTile, flowedTileIDs.contains(goalTile.id) else { return }
        status = .won
    }

    private static func buildTiles(for level: PuzzleLevel) -> [PipeTile] {
        var result: [PipeTile] = []
        let pathIndex = Dictionary(uniqueKeysWithValues: level.path.enumerated().map { ($0.element, $0.offset) })

        for row in 0..<level.size {
            for column in 0..<level.size {
                let coordinate = GridCoordinate(row: row, column: column)
                let id = "\(row)-\(column)"

                if let index = pathIndex[coordinate] {
                    let role: PipeTile.TileRole = index == 0 ? .source : (index == level.path.count - 1 ? .goal : .normal)
                    var desired = Set<GridDirection>()
                    if index > 0, let direction = coordinate.direction(to: level.path[index - 1]) {
                        desired.insert(direction)
                    }
                    if index < level.path.count - 1,
                       let direction = coordinate.direction(to: level.path[index + 1]) {
                        desired.insert(direction)
                    }

                    let kind: PipeKind
                    if desired.count == 1 {
                        kind = .cap
                    } else if desired.count == 2,
                              let first = desired.first,
                              desired.contains(first.opposite) {
                        kind = .straight
                    } else {
                        kind = .elbow
                    }

                    let targetRotation = rotationMatching(kind: kind, desired: desired)
                    let locked = role != .normal
                    let scrambleIndex = max(index - 1, 0) % max(level.scramble.count, 1)
                    let scramble = locked ? 0 : level.scramble[scrambleIndex]

                    result.append(
                        PipeTile(
                            id: id,
                            coordinate: coordinate,
                            kind: kind,
                            rotation: (targetRotation + scramble).positiveModulo(4),
                            targetRotation: targetRotation,
                            isLocked: locked,
                            isOnSolutionPath: true,
                            role: role
                        )
                    )
                } else {
                    let hash = row * 11 + column * 7 + level.id * 5
                    let kinds: [PipeKind] = [.elbow, .straight, .tee, .elbow, .straight, .empty]
                    let kind = kinds[hash % kinds.count]
                    result.append(
                        PipeTile(
                            id: id,
                            coordinate: coordinate,
                            kind: kind,
                            rotation: (hash / 3).positiveModulo(4),
                            targetRotation: nil,
                            isLocked: false,
                            isOnSolutionPath: false,
                            role: .normal
                        )
                    )
                }
            }
        }

        if let goal = result.first(where: { $0.role == .goal }),
           connectedTileIDs(in: result, size: level.size).contains(goal.id),
           let breakIndex = result.firstIndex(where: { $0.isOnSolutionPath && !$0.isLocked }) {
            result[breakIndex].rotation = (result[breakIndex].rotation + 1).positiveModulo(4)
        }

        return result
    }

    private static func rotationMatching(kind: PipeKind, desired: Set<GridDirection>) -> Int {
        for rotation in 0..<4 {
            let openings = Set(kind.baseOpenings.map { $0.rotated(clockwiseTurns: rotation) })
            if openings == desired { return rotation }
        }
        return 0
    }

    private static func connectedTileIDs(in tiles: [PipeTile], size: Int) -> Set<String> {
        guard let source = tiles.first(where: { $0.role == .source }) else { return [] }
        let byCoordinate = Dictionary(uniqueKeysWithValues: tiles.map { ($0.coordinate, $0) })
        var visited: Set<String> = [source.id]
        var queue: [PipeTile] = [source]

        while !queue.isEmpty {
            let current = queue.removeFirst()
            for direction in current.openings {
                let neighborCoordinate = current.coordinate.neighbor(toward: direction)
                guard neighborCoordinate.row >= 0,
                      neighborCoordinate.row < size,
                      neighborCoordinate.column >= 0,
                      neighborCoordinate.column < size,
                      let neighbor = byCoordinate[neighborCoordinate],
                      neighbor.openings.contains(direction.opposite),
                      !visited.contains(neighbor.id) else {
                    continue
                }

                visited.insert(neighbor.id)
                queue.append(neighbor)
            }
        }

        return visited
    }
}
