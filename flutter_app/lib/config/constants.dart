class AppConstants {
  AppConstants._();

  // API
  static const String baseUrl = 'https://smartdatapulse.tech';
  static const Duration connectTimeout = Duration(seconds: 15);
  static const Duration receiveTimeout = Duration(seconds: 30);

  // Auth (Auth0)
  static const String authDomain = 'datapulse.eu.auth0.com';
  static const String authClientId = 'P30k0QvXgyS7fwFT7nwc703WvS7XKZBV';
  static const String authRedirectUri = 'com.datapulse.app://callback';
  static const String authIssuer = 'https://$authDomain';

  // Cache
  static const Duration cacheDuration = Duration(minutes: 5);
  static const Duration longCacheDuration = Duration(hours: 1);

  // Pagination
  static const int defaultPageSize = 20;
  static const int maxPageSize = 100;

  // Rate limits
  static const int analyticsRateLimit = 60; // per minute
  static const int pipelineRateLimit = 5; // per minute

  // Date formats
  static const String dateFormat = 'yyyy-MM-dd';
  static const String displayDateFormat = 'dd MMM yyyy';
  static const String monthFormat = 'MMM yyyy';
}
