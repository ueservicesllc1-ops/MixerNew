//
//  BandSyncService.swift
//  ZionStageApple
//
//  Servidor local nativo con Network.framework (NWListener) para sincronización de banda (Band Sync).
//  El dispositivo líder actúa como Host y transmite el estado del reproductor (play/pause/seek/song)
//  a los demás dispositivos de la banda en la red local.
//

import Foundation
import Network
import Combine

public struct BandSyncState: Codable {
    public let isPlaying: Bool
    public let currentTime: Double
    public let duration: Double
    public let songId: String?
    public let songTitle: String?
    public let tempoRatio: Float
    public let pitchSemitones: Float
    public let timestamp: Double
}

public class BandSyncService: ObservableObject {
    public static let shared = BandSyncService()

    @Published public var isRunning: Bool = false
    @Published public var connectedClients: Int = 0
    @Published public var hostIP: String = "0.0.0.0"
    @Published public var port: UInt16 = 8080

    private var listener: NWListener?
    private var connectedConnections: [NWConnection] = []
    private var cancellables = Set<AnyCancellable>()

    private init() {}

    // MARK: - Iniciar Servidor Host
    public func startHost(port: UInt16 = 8080) {
        guard !isRunning else { return }
        self.port = port

        do {
            let parameters = NWParameters.tcp
            self.listener = try NWListener(using: parameters, on: NWEndpoint.Port(rawValue: port)!)

            self.listener?.stateUpdateHandler = { [weak self] state in
                DispatchQueue.main.async {
                    switch state {
                    case .ready:
                        self?.isRunning = true
                        self?.hostIP = self?.getWiFiAddress() ?? "127.0.0.1"
                        print("[BandSyncService] Servidor iniciado en \(self?.hostIP ?? ""):\(port)")
                    case .failed(let error):
                        print("[BandSyncService] Error en servidor: \(error)")
                        self?.stopHost()
                    default:
                        break
                    }
                }
            }

            self.listener?.newConnectionHandler = { [weak self] connection in
                self?.handleNewConnection(connection)
            }

            self.listener?.start(queue: .main)
            setupPlayerSyncPublisher()
        } catch {
            print("[BandSyncService] No se pudo iniciar el listener: \(error)")
        }
    }

    public func stopHost() {
        listener?.cancel()
        listener = nil
        for conn in connectedConnections {
            conn.cancel()
        }
        connectedConnections.removeAll()
        cancellables.removeAll()

        DispatchQueue.main.async {
            self.isRunning = false
            self.connectedClients = 0
            self.hostIP = "0.0.0.0"
        }
    }

    // MARK: - Manejo de Conexiones
    private func handleNewConnection(_ connection: NWConnection) {
        connection.start(queue: .main)
        connectedConnections.append(connection)

        DispatchQueue.main.async {
            self.connectedClients = self.connectedConnections.count
        }

        connection.stateUpdateHandler = { [weak self] state in
            if case .cancelled = state, case .failed = state {
                self?.removeConnection(connection)
            }
        }
    }

    private func removeConnection(_ connection: NWConnection) {
        connectedConnections.removeAll { $0 === connection }
        DispatchQueue.main.async {
            self.connectedClients = self.connectedConnections.count
        }
    }

    // MARK: - Transmitir Estado a Clientes
    private func setupPlayerSyncPublisher() {
        let player = ZionAudioPlayer.shared
        
        // Transmitir cada 100ms cuando está reproduciendo
        Timer.publish(every: 0.1, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in
                guard let self = self, self.isRunning, !self.connectedConnections.isEmpty else { return }

                let state = BandSyncState(
                    isPlaying: player.isPlaying,
                    currentTime: player.currentTime,
                    duration: player.duration,
                    songId: player.currentSong?.id,
                    songTitle: player.currentSong?.title,
                    tempoRatio: player.tempoRatio,
                    pitchSemitones: player.pitchSemitones,
                    timestamp: Date().timeIntervalSince1970
                )

                self.broadcastState(state)
            }
            .store(in: &cancellables)
    }

    private func broadcastState(_ state: BandSyncState) {
        guard let data = try? JSONEncoder().encode(state) else { return }
        let packet = data + "\n".data(using: .utf8)!

        for conn in connectedConnections {
            conn.send(content: packet, completion: .contentProcessed({ _ in }))
        }
    }

    // MARK: - Helper Dirección IP
    private func getWiFiAddress() -> String? {
        var address: String?
        var ifaddr: UnsafeMutablePointer<ifaddrs>?
        guard getifaddrs(&ifaddr) == 0 else { return nil }
        guard let firstAddr = ifaddr else { return nil }

        for ptr in sequence(first: firstAddr, next: { $0.pointee.ifa_next }) {
            let interface = ptr.pointee
            let addrFamily = interface.ifa_addr.pointee.sa_family
            if addrFamily == UInt8(AF_INET) {
                let name = String(cString: interface.ifa_name)
                if name == "en0" { // WiFi interface en iOS
                    var hostname = [CChar](repeating: 0, count: Int(NI_MAXHOST))
                    getnameinfo(interface.ifa_addr, socklen_t(interface.ifa_addr.pointee.sa_len),
                                &hostname, socklen_t(hostname.count),
                                nil, socklen_t(0), NI_NUMERICHOST)
                    address = String(cString: hostname)
                }
            }
        }
        freeifaddrs(ifaddr)
        return address
    }
}
