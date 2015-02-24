# Copyright 2015 Google Inc. All Rights Reserved.

"""Utilities for unit tests."""


class ReplaceFunction(object):
  """Makes it easier to replace a function in a class or module."""

  def __init__(self, obj, function_name, new_function):
    self.obj = obj
    self.function_name = function_name
    self.old_function = getattr(self.obj, self.function_name)
    setattr(self.obj, self.function_name, new_function)

  def __del__(self):
    setattr(self.obj, self.function_name, self.old_function)


class CapturingFunction(object):
  """Captures the last arguments called on a function."""

  def __init__(self, return_value=None):
    self.num_calls = 0
    self.return_value = return_value
    self.last_args = None
    self.last_kwargs = None

  def __call__(self, *args, **kwargs):
    self.last_args = args
    self.last_kwargs = kwargs
    self.num_calls += 1

    if callable(self.return_value):
      return self.return_value()

    return self.return_value
