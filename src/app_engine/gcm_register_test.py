# Copyright 2014 Google Inc. All Rights Reserved.

import json
import unittest

import constants
import gcm_register
import gcmrecord
import test_utilities


class BindPageHandlerTest(test_utilities.BasePageHandlerTest):
  def testBindNew(self):
    body = {
        gcm_register.PARAM_USER_ID: 'foo',
        gcm_register.PARAM_GCM_ID: 'bar'
    }
    response = self.makePostRequest('/bind/new', json.dumps(body))
    self.verifyResultCode(response, constants.RESPONSE_CODE_SENT)
    response = self.makePostRequest('/bind/new', json.dumps(body))
    self.verifyResultCode(response, constants.RESPONSE_CODE_RESENT)

    record = gcmrecord.GCMRecord.get_by_gcm_id('bar')
    gcmrecord.GCMRecord.verify(body[gcm_register.PARAM_USER_ID],
                               body[gcm_register.PARAM_GCM_ID],
                               record.code)
    response = self.makePostRequest('/bind/new', json.dumps(body))
    self.verifyResultCode(response, constants.RESPONSE_INVALID_STATE)
    self.checkInvalidRequests('/bind/new', body.keys())

  def testBindVerify(self):
    body = {
        gcm_register.PARAM_USER_ID: 'foo',
        gcm_register.PARAM_GCM_ID: 'bar'
    }
    self.makePostRequest('/bind/new', json.dumps(body))
    record = gcmrecord.GCMRecord.get_by_gcm_id('bar')

    body[gcm_register.PARAM_CODE] = 'wrong'
    response = self.makePostRequest('/bind/verify', json.dumps(body))
    self.verifyResultCode(response, constants.RESPONSE_INVALID_CODE)

    body[gcm_register.PARAM_CODE] = record.code
    response = self.makePostRequest('/bind/verify', json.dumps(body))
    self.assertIsNotNone(
        json.loads(response.body).get(gcm_register.REGISTRATION_ID_KEY))
    self.verifyResultCode(response, constants.RESPONSE_SUCCESS)

    response = self.makePostRequest('/bind/verify', json.dumps(body))
    self.verifyResultCode(response, constants.RESPONSE_INVALID_STATE)
    self.checkInvalidRequests('/bind/verify', body.keys())

  def testBindUpdate(self):
    request_1 = {
        gcm_register.PARAM_USER_ID: 'foo',
        gcm_register.PARAM_GCM_ID: 'bar'
    }
    self.makePostRequest('/bind/new', json.dumps(request_1))
    request_2 = {
        gcm_register.PARAM_USER_ID: 'foo',
        gcm_register.PARAM_OLD_GCM_ID: 'bar',
        gcm_register.PARAM_NEW_GCM_ID: 'bar2'
    }
    response = self.makePostRequest('/bind/update', json.dumps(request_2))
    self.verifyResultCode(response, constants.RESPONSE_INVALID_STATE)

    record = gcmrecord.GCMRecord.get_by_gcm_id('bar')
    request_1[gcm_register.PARAM_CODE] = record.code
    self.makePostRequest('/bind/verify', json.dumps(request_1))
    response = self.makePostRequest('/bind/update', json.dumps(request_2))
    self.verifyResultCode(response, constants.RESPONSE_SUCCESS)

    request_2[gcm_register.PARAM_OLD_GCM_ID] = 'bar2'
    request_2[gcm_register.PARAM_NEW_GCM_ID] = 'bar2'
    response = self.makePostRequest('/bind/update', json.dumps(request_2))
    self.verifyResultCode(response, constants.RESPONSE_SUCCESS)

    request_2[gcm_register.PARAM_OLD_GCM_ID] = 'bar'
    response = self.makePostRequest('/bind/update', json.dumps(request_2))
    self.verifyResultCode(response, constants.RESPONSE_NOT_FOUND)
    self.checkInvalidRequests('/bind/update', request_2.keys())

  def testBindDel(self):
    body = {
        gcm_register.PARAM_USER_ID: 'foo',
        gcm_register.PARAM_GCM_ID: 'bar'
    }
    self.makePostRequest('/bind/new', json.dumps(body))
    self.makePostRequest('/bind/del', json.dumps(body))
    record = gcmrecord.GCMRecord.get_by_gcm_id('bar')
    self.assertEqual(None, record)
    self.checkInvalidRequests('/bind/del', body.keys())

  def testBindQueryList(self):
    body = {
        gcm_register.PARAM_USER_ID: 'foo',
        gcm_register.PARAM_GCM_ID: 'bar'
    }
    self.makePostRequest('/bind/new', json.dumps(body))
    body = {
        gcm_register.PARAM_USER_ID_LIST: ['foo', 'foo2']
    }
    response = self.makePostRequest('/bind/query', json.dumps(body))
    result = json.loads(response.body)
    self.assertEqual(['foo'], result[gcm_register.VERIFIED_USER_IDS_KEY])
    self.checkInvalidRequests('/bind/query', body.keys())

  def testUpdateWithInvalidUserId(self):
    request_1 = {
        gcm_register.PARAM_USER_ID: 'foo',
        gcm_register.PARAM_GCM_ID: 'bar'
    }
    self.makePostRequest('/bind/new', json.dumps(request_1))
    record = gcmrecord.GCMRecord.get_by_gcm_id('bar')
    request_1[gcm_register.PARAM_CODE] = record.code
    self.makePostRequest('/bind/verify', json.dumps(request_1))

    request_2 = {
        gcm_register.PARAM_USER_ID: 'foo1',
        gcm_register.PARAM_OLD_GCM_ID: 'bar',
        gcm_register.PARAM_NEW_GCM_ID: 'bar2'
    }
    response = self.makePostRequest('/bind/update', json.dumps(request_2))
    self.verifyResultCode(response, constants.RESPONSE_INVALID_USER)

  def testNewWithInvalidUserId(self):
    request_1 = {
        gcm_register.PARAM_USER_ID: 'foo',
        gcm_register.PARAM_GCM_ID: 'bar'
    }
    self.makePostRequest('/bind/new', json.dumps(request_1))

    request_2 = {
        gcm_register.PARAM_USER_ID: 'foo1',
        gcm_register.PARAM_GCM_ID: 'bar'
    }
    response = self.makePostRequest('/bind/new', json.dumps(request_2))
    self.verifyResultCode(response, constants.RESPONSE_INVALID_USER)

if __name__ == '__main__':
  unittest.main()
