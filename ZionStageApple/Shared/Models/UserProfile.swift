//
//  UserProfile.swift
//  ZionStageApple
//
//  Modelo nativo para usuario y estado de suscripción.
//

import Foundation

public struct UserProfile: Identifiable, Codable, Equatable {
    public let id: String
    public var email: String
    public var displayName: String
    public var isPro: Bool
    public var planType: String // "free", "monthly", "yearly", "desktop_pro"
    public var expireDate: Date?

    public init(id: String, email: String, displayName: String, isPro: Bool = false, planType: String = "free", expireDate: Date? = nil) {
        self.id = id
        self.email = email
        self.displayName = displayName
        self.isPro = isPro
        self.planType = planType
        self.expireDate = expireDate
    }
}
