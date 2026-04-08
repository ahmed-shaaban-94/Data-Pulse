import 'package:auth0_flutter/auth0_flutter.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../config/constants.dart';

class AuthService {
  late final Auth0 _auth0;
  static const _storage = FlutterSecureStorage();

  AuthService() {
    _auth0 = Auth0(AppConstants.authDomain, AppConstants.authClientId);
  }

  Future<bool> login() async {
    try {
      final credentials = await _auth0
          .webAuthentication(scheme: 'com.datapulse.app')
          .login(useHTTPS: true);
      await _saveCredentials(credentials);
      return true;
    } catch (e) {
      return false;
    }
  }

  Future<bool> refreshToken() async {
    try {
      final refreshToken = await _storage.read(key: 'refresh_token');
      if (refreshToken == null) return false;

      final credentials = await _auth0.api.renewCredentials(
        refreshToken: refreshToken,
      );
      await _saveCredentials(credentials);
      return true;
    } catch (e) {
      return false;
    }
  }

  Future<void> logout() async {
    try {
      await _auth0
          .webAuthentication(scheme: 'com.datapulse.app')
          .logout(useHTTPS: true);
    } finally {
      await _storage.deleteAll();
    }
  }

  Future<String?> getAccessToken() async {
    return await _storage.read(key: 'access_token');
  }

  Future<bool> isAuthenticated() async {
    final token = await _storage.read(key: 'access_token');
    return token != null;
  }

  Future<void> _saveCredentials(Credentials credentials) async {
    await _storage.write(key: 'access_token', value: credentials.accessToken);
    if (credentials.refreshToken != null) {
      await _storage.write(key: 'refresh_token', value: credentials.refreshToken);
    }
    await _storage.write(key: 'id_token', value: credentials.idToken);
  }
}
