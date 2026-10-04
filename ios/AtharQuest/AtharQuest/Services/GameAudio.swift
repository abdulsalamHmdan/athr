import AVFoundation

enum GameAudio {
    private static var activePlayers: [String: AVAudioPlayer] = [:]

    static func playPipeTap(enabled: Bool) {
        play(resource: "pipe-tap", enabled: enabled)
    }

    static func playSuccess(enabled: Bool) {
        play(resource: "oasis-success", enabled: enabled)
    }

    private static func play(resource: String, enabled: Bool) {
        guard enabled,
              let url = Bundle.main.url(forResource: resource, withExtension: "wav") else {
            return
        }

        do {
            let player = try AVAudioPlayer(contentsOf: url)
            player.prepareToPlay()
            player.play()
            activePlayers[resource] = player
        } catch {
            // Sound is an enhancement; gameplay must continue if audio is unavailable.
        }
    }
}
